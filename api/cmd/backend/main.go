package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"runtime"

	"github.com/joho/godotenv"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"my.app/pkg/b2"
	"my.app/pkg/server"
)

const (
	defaultPort = "5000"
)

var enableDebug = flag.Bool("debug_enabled", false, "Enable debug logging")

func main() {
	flag.Parse()
	e := echo.New()

	e.Debug = *enableDebug
	e.Use(middleware.LoggerWithConfig(middleware.LoggerConfig{
		Format: `[${time_rfc3339}]  ${status}  ${remote_ip}  ${user_agent}  ${method}  ${host}${path} ${latency_human} ${bytes_in} | ${bytes_out}` + "\n",
	}))
	e.Use(middleware.Recover())
	e.Use(middleware.CORS()) // Default open

	// load .env file
	// Get current file full path from runtime
	_, b, _, _ := runtime.Caller(0)
	// Root folder of this project
	ProjectRootPath := filepath.Join(filepath.Dir(b), "../../")
	err := godotenv.Load(ProjectRootPath + "/.env")
	if err != nil {
		fmt.Println("No .env file found")
	}

	api := e.Group("/api")

	api.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost:5000", "http://localhost:3001"},
		AllowMethods:     []string{echo.GET, echo.PUT, echo.POST, echo.DELETE, echo.OPTIONS},
		AllowHeaders:     []string{echo.HeaderAuthorization, echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAccept},
		AllowCredentials: true,
	}))

	api.Use(middleware.CSRF())
	api.GET("/csrf-token", server.GetCSRFToken)
	api.File("/", "public/index.html")
	api.POST("/media", server.GetMediaDocument)
	api.POST("/users/login", server.UserLogin)
	api.POST("/users/password/reset", server.UserPasswordReset)
	api.GET("/medialist", server.GetFileList)

	header := api.Group("/header")

	// jwt cookie middleware
	// passwordChange is sending the token over header not cookie
	header.Use(middleware.JWTWithConfig(middleware.JWTConfig{
		SigningKey: []byte(os.Getenv("JWT_SECRET")),
	}))

	header.POST("/users/password/change", server.UserPasswordChange)

	secure := api.Group("/secure")

	// jwt cookie middleware
	secure.Use(middleware.JWTWithConfig(middleware.JWTConfig{
		SigningKey:  []byte(os.Getenv("JWT_SECRET")),
		TokenLookup: "cookie:JWTCookie",
	}))

	// csrf protection
	secure.Use(middleware.CSRFWithConfig(middleware.CSRFConfig{
		TokenLookup: "header:X-CSRF-Token",
	}))

	//secure.POST("/users/logout", server.UserLogout)
	secure.GET("/users/list", server.ListUsers)
	secure.GET("/users/current", server.GetCurrentUser)
	secure.GET("/users/:id", server.GetUserByID)
	secure.GET("/users/roles/list", server.ListUserRoles)
	secure.GET("/users/permissions/list", server.ListUserPermissions)
	secure.POST("/users/create", server.CreateUser)
	secure.POST("/users/delete", server.DeleteUser)
	secure.PUT("/users/update", server.UpdateUser)

	// media actions on b2
	secure.GET("/media/upload/authorize", b2.GetUploadURL)
	secure.GET("/media/upload/large/start/", b2.StartLargeUpload)
	secure.GET("/media/upload/large/getUrl/:fileId", b2.GetLargeUploadURL)
	secure.POST("/media/upload/large/finish/", b2.FinishLargeUpload)
	secure.GET("/media/upload/large/listParts/:fileId", b2.ListLargeFileParts)

	// media actions on database
	secure.POST("/media/db/upload/", server.UploadFileToDB)

	// Health check endpoint.
	e.GET("/healthz", server.HealthCheck)

	port := os.Getenv("PORT")
	if port == "" {
		e.Logger.Info("No port specified, using the default port.")
		port = defaultPort
	}
	e.Logger.Fatal(e.Start(fmt.Sprintf(":%s", port)))
}
