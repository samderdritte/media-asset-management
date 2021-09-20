package server

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"log"
	"net/http"
	"net/smtp"
	"os"
	"path/filepath"
	"runtime"
	"text/template"
	"time"

	"github.com/dgrijalva/jwt-go"
	"github.com/labstack/echo/middleware"
	"github.com/labstack/echo/v4"
	"golang.org/x/crypto/bcrypt"
	"gopkg.in/mgo.v2"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"

	//"go.mongodb.org/mongo-driver/mongo/readpref"
	"my.app/pkg/b2"
)

// HealthCheck performs a health check of the server
func HealthCheck(ctx echo.Context) error {
	resp := struct {
		Msg string `json:"message"`
	}{
		Msg: "All systems go.",
	}
	ctx.JSON(http.StatusOK, resp)
	return nil
}

// MediaDocument represents a single media document
type MediaDocument struct {
	Filename    string
	DateCreated time.Time
	Type        string
	Owner       string
	URL         string
	Tags        []string
	Permissions []string
	Metadata    Metadata
}

// Geoinformation contains the goeinformation of the metadata
type Geoinformation struct {
	Latitude  float64
	Longitude float64
}

// Metadata contains the metadata for a MediaDocument
type Metadata struct {
	OriginalFilename string
	OriginalDatetime time.Time
	Make             string
	Model            string
	PixelX           int
	PixelY           int
	Geo              Geoinformation
}

// MediaDocumentRequest defines the parameters for the media document request
type MediaDocumentRequest struct {
	UserID    int    `bson:"userId" json:"userId"`
	MediaType string `bson:"mediaType" json:"mediaType"`
}

// GetMediaDocument fetches a single media document from the database
func GetMediaDocument(ctx echo.Context) error {

	req := new(MediaDocumentRequest)

	if err := ctx.Bind(req); err != nil {
		return echo.NewHTTPError(http.StatusBadRequest, "invalid request object")
	}
	ctx.Logger().Debugf("received request body: %+v", req)

	// Set MongoDB client options
	uri := os.Getenv("MONGO_DB_URI")
	clientOptions := options.Client().ApplyURI(uri)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		log.Fatal(err)
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		log.Fatal(err)
	}

	// check the permission in the permissions collection
	collection := client.Database("test").Collection("users")

	var role bson.M

	filter := bson.M{"user_id": req.UserID}

	err = collection.FindOne(context.TODO(), filter, options.FindOne().SetProjection(bson.M{"_id": 0, "role": 1})).Decode(&role)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			fmt.Println(err)
		} else {
			log.Fatal(err)
		}
	}

	// then fetch the collection
	collection = client.Database("test").Collection("media")

	// create a value into which the result can be decoded
	var results []*MediaDocument

	filter = bson.M{"role": role["role"]}

	cur, err := collection.Find(context.TODO(), filter)
	if err != nil {
		log.Fatal(err)
	}

	for cur.Next(context.TODO()) {
		var elem MediaDocument
		err := cur.Decode(&elem)
		if err != nil {
			log.Fatal(err)
		}

		results = append(results, &elem)
	}

	if err := cur.Err(); err != nil {
		log.Fatal(err)
	}

	cur.Close(context.TODO())

	fmt.Printf("Found document(s): %+v\n", len(results))

	return ctx.JSON(http.StatusOK, results)
}

// GetFileList fetches all the users from the database
func GetFileList(ctx echo.Context) error {

	// First, authorize the B2 account
	auth := b2.AuthorizeB2account()

	// Now that we are authorized, we can use the token to fetch content from b2 storage
	files := b2.ListFileNames(auth)

	return ctx.JSON(http.StatusOK, files)
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func UserLogin(ctx echo.Context) error {

	req := new(LoginRequest)

	if err := ctx.Bind(req); err != nil {
		return ctx.JSON(http.StatusBadRequest, "Invalid request object")
	}
	ctx.Logger().Debugf("received request body: %+v", req)

	// Set MongoDB client options
	uri := os.Getenv("MONGO_DB_URI")
	clientOptions := options.Client().ApplyURI(uri)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		log.Fatal(err)
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		log.Fatal(err)
	}

	// check the permission in the users collection
	collection := client.Database("db-users").Collection("users")

	filter := bson.M{"email": req.Email}

	var user struct {
		ObjectID *primitive.ObjectID `json:"_id" bson:"_id"`
		ID       string
		Email    string
		Password string
		IsAdmin  bool `json:"is_admin" bson:"is_admin"`
	}

	projection := bson.M{"_id": 1, "email": 1, "password": 1, "is_admin": 1}
	err = collection.FindOne(context.TODO(), filter, options.FindOne().SetProjection(projection)).Decode(&user)

	// We don't need the DB connection anymore, thus close it
	disconnectError := client.Disconnect(context.TODO())
	if disconnectError != nil {
		log.Fatal(disconnectError)
	}

	if err != nil {
		if err == mongo.ErrNoDocuments {
			return ctx.JSON(http.StatusBadRequest, "No account with this email has been registered.")
		} else {
			log.Fatal(err)
		}
	}
	user.ID = user.ObjectID.Hex()

	/*
		// Hashing the password with the default cost of 10
		hashedPassword, err := bcrypt.GenerateFromPassword(enterdPassword, bcrypt.DefaultCost)
		if err != nil {
			panic(err)
		}
		fmt.Println("hashed password: ", string(hashedPassword))
	*/
	// use bcrypt to compare password with password in db
	enterdPassword := []byte(req.Password)
	userPassword := []byte(user.Password)

	// Comparing the password with the hash
	err = bcrypt.CompareHashAndPassword(userPassword, enterdPassword)
	if err != nil {
		return ctx.JSON(http.StatusUnauthorized, "Please provide valid credentials")
	}

	// Create JWT Token
	var jwtKey = []byte(os.Getenv("JWT_SECRET"))

	// Declare the expiration time of the token
	// here, we have kept it as 5 minutes
	//expirationTime := time.Now().Add(5 * time.Minute)
	expirationTime := time.Now().Add(1 * time.Hour)
	// Create the JWT claims, which includes the username and expiry time
	claims := &Claims{
		Email:   user.Email,
		ID:      user.ID,
		IsAdmin: user.IsAdmin,
		StandardClaims: jwt.StandardClaims{
			// In JWT, the expiry time is expressed as unix milliseconds
			ExpiresAt: expirationTime.Unix(),
		},
	}

	// Declare the token with the algorithm used for signing, and the claims
	rawToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	// Create the JWT string
	token, err := rawToken.SignedString(jwtKey)
	if err != nil {
		// If there is an error in creating the JWT return an internal server error
		return ctx.JSON(http.StatusInternalServerError, "Internal Server Error")
	}

	var userResponse LoginUser
	userResponse.Email = user.Email
	userResponse.ID = user.ID
	userResponse.IsAdmin = user.IsAdmin
	results := &UserLoginResponse{
		Token: token,
		User:  userResponse,
	}
	fmt.Println(results)

	// create a httpOnly cookie with the jwt token
	jwtCookie := &http.Cookie{} //new(http.Cookie)
	jwtCookie.Name = "JWTCookie"
	jwtCookie.Value = token
	jwtCookie.Expires = expirationTime
	jwtCookie.HttpOnly = true
	//jwtCookie.Domain = ".localhost"
	jwtCookie.Path = "/"
	//jwtCookie.SameSite = 3
	//jwtCookie.Secure = true
	ctx.SetCookie(jwtCookie)

	return ctx.JSON(http.StatusOK, results)
}

type LoginUser struct {
	ID      string
	Email   string
	IsAdmin bool
}

type UserLoginResponse struct {
	Token string
	User  LoginUser
}

// User represents a single user
type User struct {
	ID          string    `json:"_id" bson:"_id"`
	Name        string    `json:"name" bson:"name"`
	Surname     string    `json:"surname" bson:"surname"`
	Email       string    `json:"email" bson:"email"`
	Address     string    `json:"address" bson:"address"`
	City        string    `json:"city" bson:"city"`
	Country     string    `json:"country" bson:"country"`
	ZipCode     string    `json:"zip_code" bson:"zip_code"`
	Permissions []string  `json:"permissions" bson:"permissions"`
	Role        string    `json:"role" bson:"role"`
	IsAdmin     bool      `json:"is_admin" bson:"is_admin"`
	CreateDate  time.Time `json:"create_date" bson:"create_date"`
}

// User represents a single user
type UserShort struct {
	ID          string    `json:"_id" bson:"_id"`
	Name        string    `json:"name" bson:"name"`
	Surname     string    `json:"surname" bson:"surname"`
	Email       string    `json:"email" bson:"email"`
	Permissions []string  `json:"permissions" bson:"permissions"`
	Role        string    `json:"role" bson:"role"`
	IsAdmin     bool      `json:"is_admin" bson:"is_admin"`
	CreateDate  time.Time `json:"create_date" bson:"create_date"`
}

// GetUsers fetches all the users from the database
func ListUsers(ctx echo.Context) error {

	// Get the jwt token from context
	user := ctx.Get("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)

	// check if the user has admin rights
	isAdmin := claims["is_admin"].(bool)
	if !isAdmin {
		return ctx.JSON(http.StatusUnauthorized, "Administrator rights are required to list users.")
	}

	// Set MongoDB client options
	uri := os.Getenv("MONGO_DB_URI")
	clientOptions := options.Client().ApplyURI(uri)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		log.Fatal(err)
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		log.Fatal(err)
	}

	// check the permission in the users collection
	collection := client.Database("db-users").Collection("users")

	// create a value into which the result can be decoded
	var results []*UserShort

	filter := bson.M{} // empty filter to return all elements
	cur, err := collection.Find(context.TODO(), filter)
	if err != nil {
		log.Fatal(err)
	}

	for cur.Next(context.TODO()) {
		var elem UserShort
		err := cur.Decode(&elem)
		if err != nil {
			log.Fatal(err)
		}

		results = append(results, &elem)
	}

	if err := cur.Err(); err != nil {
		log.Fatal(err)
	}

	cur.Close(context.TODO())

	// We don't need the DB connection anymore, thus close it
	disconnectError := client.Disconnect(context.TODO())
	if disconnectError != nil {
		log.Fatal(disconnectError)
	}

	return ctx.JSON(http.StatusOK, results)
}

type Claims struct {
	Email   string `json:"email"`
	ID      string `json:"ID"`
	IsAdmin bool   `json:"is_admin"`
	jwt.StandardClaims
}

// GetUsers fetches all the users from the database
func GetCurrentUser(ctx echo.Context) error {

	// Get the jwt token from context
	user := ctx.Get("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)

	// Set MongoDB client options
	uri := os.Getenv("MONGO_DB_URI")
	clientOptions := options.Client().ApplyURI(uri)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		log.Fatal(err)
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		log.Fatal(err)
	}

	// check the permission in the users collection
	collection := client.Database("db-users").Collection("users")

	// create a value into which the result can be decoded
	var result User

	objIDString := claims["ID"].(string)
	objID, _ := primitive.ObjectIDFromHex(objIDString)
	filter := bson.M{"_id": objID}

	err = collection.FindOne(context.TODO(), filter, options.FindOne()).Decode(&result)

	// We don't need the DB connection anymore, thus close it
	disconnectError := client.Disconnect(context.TODO())
	if disconnectError != nil {
		log.Fatal(disconnectError)
	}

	if err != nil {
		if err == mongo.ErrNoDocuments {
			return ctx.JSON(http.StatusBadRequest, "No User with this id exists.")
		} else {
			log.Fatal(err)
		}
	}

	return ctx.JSON(http.StatusOK, result)
}

// GetUserByID a user by ID from the DB
func GetUserByID(ctx echo.Context) error {

	// Get the ID from params
	// This is the ID of the user which should be returned from the dB
	requestedID := ctx.Param("id")

	// Get the jwt token from context
	user := ctx.Get("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)

	// Check if the user has admin rights
	isAdmin := claims["is_admin"].(bool)
	// Get the ID of the user who is making the reqest
	userID := claims["ID"]

	// Check whether the user requests his own profile
	isOwnID := (requestedID == userID)

	// If the request is for another id, then admin rights are needed to proceed
	if !isOwnID && !isAdmin {
		return ctx.JSON(http.StatusUnauthorized, "Administrator rights are required to fetch other users.")
	}

	// Set MongoDB client options
	uri := os.Getenv("MONGO_DB_URI")
	clientOptions := options.Client().ApplyURI(uri)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		log.Fatal(err)
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		log.Fatal(err)
	}

	// check the permission in the users collection
	collection := client.Database("db-users").Collection("users")

	// create a value into which the result can be decoded
	var result User

	objID, _ := primitive.ObjectIDFromHex(requestedID)
	filter := bson.M{"_id": objID}

	err = collection.FindOne(context.TODO(), filter, options.FindOne()).Decode(&result)

	// We don't need the DB connection anymore, thus close it
	disconnectError := client.Disconnect(context.TODO())
	if disconnectError != nil {
		log.Fatal(disconnectError)
	}

	if err != nil {
		if err == mongo.ErrNoDocuments {
			return ctx.JSON(http.StatusBadRequest, "No User with this id exists.")
		} else {
			log.Fatal(err)
		}
	}

	return ctx.JSON(http.StatusOK, result)
}

// Role describes a single role
type Role struct {
	Name  string `json:"name" bson:"name"`
	Label string `json:"label" bson:"label"`
}

// GetUserRoles fetches all the user roles from the database
func ListUserRoles(ctx echo.Context) error {

	// Set MongoDB client options
	uri := os.Getenv("MONGO_DB_URI")
	clientOptions := options.Client().ApplyURI(uri)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		log.Fatal(err)
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		log.Fatal(err)
	}

	// check the permission in the users collection
	collection := client.Database("db-users").Collection("roles")

	// create a value into which the result can be decoded
	var results []*Role

	filter := bson.M{} // empty filter to return all elements

	cur, err := collection.Find(context.TODO(), filter)
	if err != nil {
		log.Fatal(err)
	}

	for cur.Next(context.TODO()) {
		var elem Role
		err := cur.Decode(&elem)
		if err != nil {
			log.Fatal(err)
		}

		results = append(results, &elem)
	}

	if err := cur.Err(); err != nil {
		log.Fatal(err)
	}

	cur.Close(context.TODO())

	// We don't need the DB connection anymore, thus close it
	disconnectError := client.Disconnect(context.TODO())
	if disconnectError != nil {
		log.Fatal(disconnectError)
	}

	return ctx.JSON(http.StatusOK, results)
}

// Role describes a single role
type Permission struct {
	Name  string `json:"name" bson:"name"`
	Label string `json:"label" bson:"label"`
}

// GetUserRoles fetches all the user roles from the database
func ListUserPermissions(ctx echo.Context) error {

	// Set MongoDB client options
	uri := os.Getenv("MONGO_DB_URI")
	clientOptions := options.Client().ApplyURI(uri)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		log.Fatal(err)
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		log.Fatal(err)
	}

	collection := client.Database("db-users").Collection("permissions")

	// create a value into which the result can be decoded
	var results []*Permission

	filter := bson.M{} // empty filter to return all elements

	cur, err := collection.Find(context.TODO(), filter)
	if err != nil {
		log.Fatal(err)
	}

	for cur.Next(context.TODO()) {
		var elem Permission
		err := cur.Decode(&elem)
		if err != nil {
			log.Fatal(err)
		}

		results = append(results, &elem)
	}

	if err := cur.Err(); err != nil {
		log.Fatal(err)
	}

	cur.Close(context.TODO())

	// We don't need the DB connection anymore, thus close it
	disconnectError := client.Disconnect(context.TODO())
	if disconnectError != nil {
		log.Fatal(disconnectError)
	}

	return ctx.JSON(http.StatusOK, results)
}

type CreateRequest struct {
	Email string `json:"email"`
}

type NewUser struct {
	Email         string    `json:"email" bson:"email"`
	Password      string    `json:"password" bson:"password"`
	IsAdmin       bool      `json:"is_admin" bson:"is_admin"`
	Role          string    `json:"role" bson:"role"`
	EmailVerified bool      `json:"email_verified" bson:"email_verified"`
	CreateDate    time.Time `json:"create_date" bson:"create_date"`
}

func CreateUser(ctx echo.Context) error {

	// Get the jwt token from context
	user := ctx.Get("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)

	// check if the user has admin rights
	isAdmin := claims["is_admin"].(bool)
	if !isAdmin {
		return ctx.JSON(http.StatusUnauthorized, "Administrator rights are required to create a new user.")
	}

	req := new(CreateRequest)
	if err := ctx.Bind(req); err != nil {
		return ctx.JSON(http.StatusBadRequest, "Invalid request object")
	}
	ctx.Logger().Debugf("received request body: %+v", req)

	// Set MongoDB client options
	uri := os.Getenv("MONGO_DB_URI")
	clientOptions := options.Client().ApplyURI(uri)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		log.Fatal(err)
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		log.Fatal(err)
	}

	// check the permission in the users collection
	collection := client.Database("db-users").Collection("users")

	// Create a random password which will be stored in the db
	// The user will have to set his password when he receives the link
	pw := make([]byte, 32)
	_, err = rand.Read(pw)
	if err != nil {
		fmt.Println(err)
	}
	randomPassword := base64.StdEncoding.EncodeToString(pw)

	// Hash the password with bcrypt
	hash, err := bcrypt.GenerateFromPassword([]byte(randomPassword), 10)
	if err != nil {
		log.Fatal(err)
	}

	email := req.Email
	// Create a new user
	newUser := NewUser{email, string(hash), false, "editor", false, time.Now()}
	insertResult, err := collection.InsertOne(context.TODO(), newUser)
	if err != nil {
		if !mgo.IsDup(err) {
			return ctx.JSON(http.StatusBadRequest, "User with the same email already exists.")
		}
		log.Fatal(err)
	}
	fmt.Println("Inserted a single document: ", insertResult.InsertedID)

	// Now that the know that the user exists in the db,
	// we continue with creating the token to reset the password

	// Declare the expiration time of the token
	// Expiration time set to 1 hour to include possible delays in email delivery
	expirationTime := time.Now().Add(1 * time.Hour)

	// Generate a random resetToken which will be stored in the database
	rb := make([]byte, 32)
	_, err = rand.Read(rb)
	if err != nil {
		fmt.Println(err)
	}
	resetToken := base64.StdEncoding.EncodeToString(rb)

	newClaims := struct {
		Email      string `json:"email"`
		ResetToken string `json:"resetToken"`
		jwt.StandardClaims
	}{
		Email:      req.Email,
		ResetToken: resetToken,
		StandardClaims: jwt.StandardClaims{
			// In JWT, the expiry time is expressed as unix milliseconds
			ExpiresAt: expirationTime.Unix(),
		},
	}

	// Store resetToken and expiry time in the db
	// update the user
	filter := bson.M{"email": email}
	updatedValues := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "passwordResetToken", Value: resetToken},
			{Key: "passwordResetTokenExpires", Value: expirationTime.Unix()},
			{Key: "last_updated", Value: time.Now()},
		}},
	}
	updateResult, err := collection.UpdateOne(context.TODO(), filter, updatedValues)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Updated %d document with resetToken. \n", updateResult.ModifiedCount)

	// Create JWT Token
	var jwtKey = []byte(os.Getenv("JWT_SECRET"))

	// Declare the token with the algorithm used for signing, and the claims
	rawToken := jwt.NewWithClaims(jwt.SigningMethodHS256, newClaims)

	// Create the JWT string
	token, err := rawToken.SignedString(jwtKey)

	if err != nil {
		// If there is an error in creating the JWT return an internal server error

		return ctx.JSON(http.StatusInternalServerError, "Internal Server Error")
	}

	// send confirmation email to user
	// Get current file full path from runtime
	_, b, _, _ := runtime.Caller(0)
	// Root folder of this project
	ProjectRootPath := filepath.Join(filepath.Dir(b), "../../")
	templateFile := ProjectRootPath + "/cmd/backend/template_create_user.html"
	subject := "User created for for Media Hub"
	url := "http://localhost:3001/admin/users/password-change/?token="
	jwtToken := token
	link := url + jwtToken

	err = sendEmail(templateFile, email, subject, link)
	if err != nil {
		fmt.Println(err)
	}

	newUserID := struct {
		ID string `json:"id"`
	}{
		ID: insertResult.InsertedID.(primitive.ObjectID).Hex(),
	}
	return ctx.JSON(http.StatusOK, newUserID)
}

//UpdatePasswordRequest describes the structure to request a new password
type UpdatePasswordRequest struct {
	Email string `json:"email"`
}

// UserPasswordReset resets a password for a given user
// Takes an email address as request and sends an email with
// a link to reset the password
// Note: The function will always return with a sucess message even if the request is malformed or the
// user could not be found in the database.
func UserPasswordReset(ctx echo.Context) error {

	req := new(UpdatePasswordRequest)

	if err := ctx.Bind(req); err != nil {
		return ctx.JSON(http.StatusOK, "Password reset email sent.")
	}
	ctx.Logger().Debugf("Received password update request: %+v", req)

	email := req.Email

	// Set MongoDB client options
	uri := os.Getenv("MONGO_DB_URI")
	clientOptions := options.Client().ApplyURI(uri)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		log.Fatal(err)
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		log.Fatal(err)
	}

	// connect to the collection in the DB
	collection := client.Database("db-users").Collection("users")

	// First, check whether a user with the requested email actually exists
	filter := bson.M{"email": req.Email}
	var result bson.M
	err = collection.FindOne(context.TODO(), filter, options.FindOne().SetProjection(bson.M{"_id": 0, "email": 1})).Decode(&result)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			fmt.Printf("Bad password reset request. No user with email '%s' found\n", email)
			return ctx.JSON(http.StatusOK, "Password reset email sent.")
		} else {
			log.Fatal(err)
		}
	}

	// Now that the know that the user exists in the db,
	// we continue with creating the token to reset the password

	// Declare the expiration time of the token
	// Expiration time set to 1 hour to include possible delays in email delivery
	expirationTime := time.Now().Add(1 * time.Hour)

	// Generate a random resetToken which will be stored in the database
	rb := make([]byte, 32)
	_, err = rand.Read(rb)
	if err != nil {
		fmt.Println(err)
	}
	resetToken := base64.StdEncoding.EncodeToString(rb)

	claims := struct {
		Email      string `json:"email"`
		ResetToken string `json:"resetToken"`
		jwt.StandardClaims
	}{
		Email:      email,
		ResetToken: resetToken,
		StandardClaims: jwt.StandardClaims{
			// In JWT, the expiry time is expressed as unix milliseconds
			ExpiresAt: expirationTime.Unix(),
		},
	}

	// Store resetToken and expiry time in the db
	// update the user
	filter = bson.M{"email": email}
	updatedValues := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "passwordResetToken", Value: resetToken},
			{Key: "passwordResetTokenExpires", Value: expirationTime.Unix()},
			{Key: "last_updated", Value: time.Now()},
		}},
	}
	updateResult, err := collection.UpdateOne(context.TODO(), filter, updatedValues)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Updated %d document with resetToken. \n", updateResult.ModifiedCount)

	// Create JWT Token
	var jwtKey = []byte(os.Getenv("JWT_SECRET"))

	// Declare the token with the algorithm used for signing, and the claims
	rawToken := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

	// Create the JWT string
	token, err := rawToken.SignedString(jwtKey)

	if err != nil {
		// If there is an error in creating the JWT return an internal server error

		return ctx.JSON(http.StatusInternalServerError, "Internal Server Error")
	}

	// send confirmation email to user
	// Get current file full path from runtime
	_, b, _, _ := runtime.Caller(0)
	// Root folder of this project
	ProjectRootPath := filepath.Join(filepath.Dir(b), "../../")

	templateFile := ProjectRootPath + "/cmd/backend/template_email_reset.html"
	subject := "Password reset for Media Hub"
	url := "http://localhost:3001/admin/users/password-change/?token="
	jwtToken := token
	link := url + jwtToken

	err = sendEmail(templateFile, email, subject, link)
	if err != nil {
		fmt.Println(err)
	}

	return ctx.JSON(http.StatusOK, "Password reset email sent.")
}

//ChangePasswordRequest describes the structure to request a new password
type ChangePasswordRequest struct {
	Password        string `json:"password"`
	ConfirmPassword string `json:"confirmPassword"`
}

// UserPasswordChange changes the password for a given user
func UserPasswordChange(ctx echo.Context) error {

	req := new(ChangePasswordRequest)

	if err := ctx.Bind(req); err != nil {
		return ctx.JSON(http.StatusBadRequest, "Invalid request object")
	}
	ctx.Logger().Debugf("Received password update request: %+v", req)

	newPassword := req.Password
	newConfirmedPassword := req.ConfirmPassword

	// Server side check that the passwords match
	if newPassword != newConfirmedPassword {
		return ctx.JSON(http.StatusBadRequest, "Passwords do not match")
	}

	//Hash the new password with bcrypt
	hashedPassword, err := bcrypt.GenerateFromPassword([]byte(req.Password), 10)
	if err != nil {
		fmt.Println(err)
	}

	// Set MongoDB client options
	uri := os.Getenv("MONGO_DB_URI")
	clientOptions := options.Client().ApplyURI(uri)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		log.Fatal(err)
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		log.Fatal(err)
	}

	// connect to the collection in the DB
	collection := client.Database("db-users").Collection("users")

	// Next we want to check the resetToken in the database
	// Read the resetToken and exires date from the jwt token
	claims := ctx.Get("user").(*jwt.Token).Claims.(jwt.MapClaims)
	email := claims["email"]
	resetToken := claims["resetToken"]
	// expires date was stored as int64 in the database, but mapClaims returns a float64
	expires := int64(claims["exp"].(float64))
	var resetTokenValuesDB bson.M

	// Get the stored values in the database
	filter := bson.M{"email": email}
	err = collection.FindOne(context.TODO(), filter, options.FindOne().SetProjection(bson.M{"_id": 0, "passwordResetToken": 1, "passwordResetTokenExpires": 1})).Decode(&resetTokenValuesDB)
	if err != nil {
		if err == mongo.ErrNoDocuments {
			fmt.Println(err)
		} else {
			log.Fatal(err)
		}
	}
	resetTokenDB := resetTokenValuesDB["passwordResetToken"]
	expiresDB := resetTokenValuesDB["passwordResetTokenExpires"]

	// Compare the reset Token and expires date to the values in the database
	if !(expires == expiresDB) || !(resetToken == resetTokenDB) {
		return ctx.JSON(http.StatusBadRequest, "Invalid reset token")
	}

	// All is fine, so we can go ahead and update the password in the database
	// At the same time, we delete the reset token from the db
	updatedValues := bson.D{
		{Key: "$set", Value: bson.D{
			{Key: "password", Value: hashedPassword},
			{Key: "last_updated", Value: time.Now()},
		}},
		{Key: "$unset", Value: bson.D{
			{Key: "passwordResetToken", Value: ""},
			{Key: "passwordResetTokenExpires", Value: ""},
		}},
	}
	updateResult, err := collection.UpdateOne(context.TODO(), filter, updatedValues)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Updated %d document with resetToken. \n", updateResult.ModifiedCount)

	return ctx.JSON(http.StatusOK, "Password changed sucessfully.")
}

type UpdatedUserRequest struct {
	ID          string   `json:"_id" bson:"_id"`
	Name        string   `json:"name" bson:"name"`
	Surname     string   `json:"surname" bson:"surname"`
	Email       string   `json:"email" bson:"email"`
	Address     string   `json:"address" bson:"address"`
	City        string   `json:"city" bson:"city"`
	Country     string   `json:"country" bson:"country"`
	ZipCode     string   `json:"zip_code" bson:"zip_code"`
	Permissions []string `json:"permissions" bson:"permissions"`
	Role        string   `json:"role" bson:"role"`
}

func UpdateUser(ctx echo.Context) error {

	// Get the jwt token from context
	user := ctx.Get("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)

	// check if the user has admin rights
	isAdmin := claims["is_admin"].(bool)

	req := new(UpdatedUserRequest)

	if err := ctx.Bind(req); err != nil {
		return ctx.JSON(http.StatusBadRequest, "Invalid request object")
	}
	ctx.Logger().Debugf("received request body: %+v", req)

	// Set MongoDB client options
	uri := os.Getenv("MONGO_DB_URI")
	clientOptions := options.Client().ApplyURI(uri)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		log.Fatal(err)
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		log.Fatal(err)
	}

	// check the permission in the users collection
	collection := client.Database("db-users").Collection("users")

	id, _ := primitive.ObjectIDFromHex(req.ID)
	fmt.Println("id", id)
	// update the user
	filter := bson.M{"_id": id}
	updatedValues := bson.D{
		{"$set", bson.D{
			{"name", req.Name},
			{"surname", req.Surname},
			{"address", req.Address},
			{"city", req.City},
			{"country", req.Country},
			{"zip_code", req.ZipCode},
			{"last_updated", time.Now()},
		}},
	}
	if isAdmin {
		updatedValues = bson.D{
			{"$set", bson.D{
				{"name", req.Name},
				{"surname", req.Surname},
				{"address", req.Address},
				{"city", req.City},
				{"country", req.Country},
				{"zip_code", req.ZipCode},
				{"permissions", req.Permissions},
				{"role", req.Role},
				{"last_updated", time.Now()},
			}},
		}
	}
	updateResult, err := collection.UpdateOne(context.TODO(), filter, updatedValues)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Updated %d document: ", updateResult.ModifiedCount)

	// We don't need the DB connection anymore, thus close it
	disconnectError := client.Disconnect(context.TODO())
	if disconnectError != nil {
		log.Fatal(disconnectError)
	}

	return ctx.JSON(http.StatusOK, "update successful")
}

type DeleteRequest struct {
	Email string `json:"email"`
}

func DeleteUser(ctx echo.Context) error {

	// Get the jwt token from context
	user := ctx.Get("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)

	// check if the user has admin rights
	isAdmin := claims["is_admin"].(bool)
	if !isAdmin {
		return ctx.JSON(http.StatusUnauthorized, "Administrator rights are required to delete a user.")
	}

	req := new(DeleteRequest)
	if err := ctx.Bind(req); err != nil {
		return ctx.JSON(http.StatusBadRequest, "Invalid request object")
	}
	ctx.Logger().Debugf("received request body: %+v", req)

	// Set MongoDB client options
	uri := os.Getenv("MONGO_DB_URI")
	clientOptions := options.Client().ApplyURI(uri)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		log.Fatal(err)
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		log.Fatal(err)
	}

	// check the permission in the users collection
	collection := client.Database("db-users").Collection("users")

	// Delete the user
	filter := bson.M{"email": req.Email}
	deleteResult, err := collection.DeleteOne(context.TODO(), filter)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Printf("Deleted %v documents in the trainers collection\n", deleteResult.DeletedCount)

	return ctx.NoContent(http.StatusNoContent)
}

func sendEmail(templateFile string, email string, subject string, link string) error {

	// Sender data.
	from := os.Getenv("SMTP_FROM")
	password := os.Getenv("SMTP_PASSWORD")

	// Receiver email address.
	to := []string{
		email,
	}
	// smtp server configuration.
	smtpServer := smtpServer{host: os.Getenv("SMTP_HOST"), port: os.Getenv("SMTP_PORT")}

	// Authentication.
	auth := smtp.PlainAuth("", from, password, smtpServer.host)

	t, err := template.ParseFiles(templateFile)
	if err != nil {
		fmt.Println("err", err)
	}

	var body bytes.Buffer

	mimeHeaders := "MIME-version: 1.0;\nContent-Type: text/html; charset=\"UTF-8\";\n\n"
	body.Write([]byte(fmt.Sprintf("To: %s\nFrom: Media Hub \nSubject: %s \n%s\n\n", to[0], subject, mimeHeaders)))

	err = t.Execute(&body, struct {
		Email string
		Link  string
	}{
		Email: email,
		Link:  link,
	})
	if err != nil {
		fmt.Println(err)
	}
	// Sending email.
	err = smtp.SendMail(smtpServer.Address(), auth, from, to, body.Bytes())
	if err != nil {
		fmt.Println(err)
		return err
	}
	fmt.Println("Email Sent!")

	return nil
}

// smtpServer data to smtp server
type smtpServer struct {
	host string
	port string
}

// Address URI to smtp server
func (s *smtpServer) Address() string {
	return s.host + ":" + s.port
}

type CSRFToken struct {
	Token string `json:"csrfToken"`
}

func GetCSRFToken(ctx echo.Context) error {

	csrfToken := &CSRFToken{
		Token: ctx.Get(middleware.DefaultCSRFConfig.ContextKey).(string),
	}
	return ctx.JSON(http.StatusOK, csrfToken)
}

// UploadFileToDB uploads file metadata to the database
func UploadFileToDB(ctx echo.Context) error {

	// Get the jwt token from context
	user := ctx.Get("user").(*jwt.Token)
	claims := user.Claims.(jwt.MapClaims)

	// check if the user has admin rights
	isAdmin := claims["is_admin"].(bool)
	if !isAdmin {
		return ctx.JSON(http.StatusUnauthorized, "Administrator rights are required to upload a new file to the database.")
	}

	reqBody := echo.Map{}
	if err := ctx.Bind(&reqBody); err != nil {
		return err
	}

	ctx.Logger().Debugf("received request body: %+v", reqBody)
	//fmt.Println("reqBody", reqBody)
	// Set MongoDB client options
	uri := os.Getenv("MONGO_DB_URI")
	clientOptions := options.Client().ApplyURI(uri)

	// Connect to MongoDB
	client, err := mongo.Connect(context.TODO(), clientOptions)

	if err != nil {
		log.Fatal(err)
	}

	// Check the connection
	err = client.Ping(context.TODO(), nil)

	if err != nil {
		log.Fatal(err)
	}

	collection := client.Database("db-media").Collection("media")

	insertResult, err := collection.InsertOne(context.TODO(), reqBody)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println("Inserted a single document: ", insertResult.InsertedID)

	return ctx.JSON(http.StatusOK, reqBody)

}
