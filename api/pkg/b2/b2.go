package b2

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/labstack/echo/v4"
)

// AuthorizeResponse defines the parameter for the authorization response from B2
type AuthorizeResponse struct {
	AccountID          string `json:"accountId"`
	APIURL             string `json:"apiUrl"`
	AuthorizationToken string `json:"authorizationToken"`
	DownloadURL        string `json:"downloadUrl"`
}

func redirectPolicyFunc(req *http.Request, via []*http.Request) error {
	req.Header.Add("Authorization", "Basic "+basicAuth(os.Getenv("B2_KEY_ID"), os.Getenv("B2_APPLICATION_KEY")))
	return nil
}

func basicAuth(username, password string) string {
	auth := username + ":" + password
	return base64.StdEncoding.EncodeToString([]byte(auth))
}

func AuthorizeB2account() *AuthorizeResponse {
	client := &http.Client{
		CheckRedirect: redirectPolicyFunc,
	}

	url := "https://api.backblazeb2.com/b2api/v2/b2_authorize_account"

	request, err := http.NewRequest("GET", url, nil)
	if err != nil {
		fmt.Println(err)
	}
	request.Header.Add("Authorization", "Basic "+basicAuth(os.Getenv("B2_KEY_ID"), os.Getenv("B2_APPLICATION_KEY")))
	resp, err := client.Do(request)
	decoder := json.NewDecoder(resp.Body)
	authorization := new(AuthorizeResponse)
	err = decoder.Decode(&authorization)
	if err != nil {
		fmt.Println(err)
	}

	return authorization
}

// File defines the parameters of a single file in the b2 storage
type File struct {
	FileID          string `json:"fileId"`
	Filename        string `json:"fileName"`
	UploadTimestamp int    `json:"uploadTimestamp"`
	AccountID       string `json:"accountId"`
	BucketID        string `json:"bucketId"`
	ContentLenght   int    `json:"contentLength"`
	ContentType     string `json:"contentType"`
	ContentSha1     string `json:"contentSha1"`
}

// Files is how b2 storage api returns the json
type Files struct {
	Files        []File
	NextFileName string
}

// ListFileNames list the files in the b2 storage
func ListFileNames(Authorization *AuthorizeResponse) *Files {

	client := &http.Client{}

	url := Authorization.APIURL + "/b2api/v2/b2_list_file_names"

	requestBody := []byte(`{"bucketId":"` + os.Getenv("B2_BUCKET_ID") + `","maxFileCount":1000}`)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		fmt.Println(err)
	}
	req.Header.Add("Authorization", Authorization.AuthorizationToken)

	resp, err := client.Do(req)
	bodyBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}
	files := new(Files)
	json.Unmarshal([]byte(bodyBytes), &files)
	return files
}

type GetB2UploadURLResponse struct {
	AuthorizationToken string `json:"authorizationToken"`
	BucketID           string `json:"bucketID"`
	UploadURL          string `json:"uploadUrl"`
}

// GetUploadURL calls the b2 API to get an upload url
func GetUploadURL(ctx echo.Context) error {

	authorizeResponse := AuthorizeB2account()

	client := &http.Client{}

	url := authorizeResponse.APIURL + "/b2api/v2/b2_get_upload_url"
	requestBody := []byte(`{"bucketId":"` + os.Getenv("B2_BUCKET_ID") + `"}`)
	req, err := http.NewRequest("POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		fmt.Println(err)
	}
	req.Header.Add("Authorization", authorizeResponse.AuthorizationToken)

	resp, err := client.Do(req)
	bodyBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}

	response := new(GetB2UploadURLResponse)
	json.Unmarshal([]byte(bodyBytes), &response)

	return ctx.JSON(http.StatusOK, response)
}

type GetB2LargeUploadStartResponse struct {
	AccountID       string    `json:"accountId"`
	Action          string    `json:"action"`
	BucketID        string    `json:"bucketId"`
	ContentLength   int64     `json:"contentLength"`
	ContentSha1     string    `json:"contentSha1"`
	ContentType     string    `json:"contentType"`
	FileID          string    `json:"fileId"`
	FileName        string    `json:"fileName"`
	UploadTimestamp time.Time `json:"uploadTimestamp"`
}

func StartLargeUpload(ctx echo.Context) error {

	authorizeResponse := AuthorizeB2account()

	client := &http.Client{}

	url := authorizeResponse.APIURL + "/b2api/v2/b2_start_large_file"

	filename := ctx.QueryParam("filename")
	buckedID := os.Getenv("B2_BUCKET_ID")
	contentType := ctx.QueryParam("contentType")
	requestBody := []byte(`{"bucketId":"` + buckedID + `", "fileName":"` + filename + `", "contentType":"` + contentType + `"}`)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		fmt.Println(err)
	}
	req.Header.Add("Authorization", authorizeResponse.AuthorizationToken)

	resp, err := client.Do(req)
	bodyBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}

	response := new(GetB2LargeUploadStartResponse)
	json.Unmarshal([]byte(bodyBytes), &response)

	return ctx.JSON(http.StatusOK, response)
}

type GetB2LargeUploadURLResponse struct {
	FileID             string `json:"fileId"`
	UploadURL          string `json:"uploadUrl"`
	AuthorizationToken string `json:"authorizationToken"`
}

// GetLargeUploadURL calls the b2 API to get a large upload url
func GetLargeUploadURL(ctx echo.Context) error {

	fileID := ctx.Param("fileId")

	authorizeResponse := AuthorizeB2account()

	client := &http.Client{}

	url := authorizeResponse.APIURL + "/b2api/v2/b2_get_upload_part_url"

	requestBody := []byte(`{"fileId":"` + fileID + `"}`)

	fmt.Println(fileID)

	req, err := http.NewRequest("POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		fmt.Println(err)
	}
	req.Header.Add("Authorization", authorizeResponse.AuthorizationToken)

	resp, err := client.Do(req)
	bodyBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}

	response := new(GetB2LargeUploadURLResponse)
	json.Unmarshal([]byte(bodyBytes), &response)

	return ctx.JSON(http.StatusOK, response)
}

type finishLargeUploadRequest struct {
	FileID        string   `json:"fileId"`
	PartSha1Array []string `json:"partSha1Array"`
}

func FinishLargeUpload(ctx echo.Context) error {

	req := new(finishLargeUploadRequest)
	if err := ctx.Bind(req); err != nil {
		return ctx.JSON(http.StatusBadRequest, "Invalid request object")
	}
	ctx.Logger().Debugf("received request body: %+v", req)

	authorizeResponse := AuthorizeB2account()

	client := &http.Client{}

	url := authorizeResponse.APIURL + "/b2api/v2/b2_finish_large_file"

	requestBody, err := json.Marshal(req)
	if err != nil {
		log.Fatal(err)
	}
	fmt.Println(req.FileID)
	fmt.Println("requestBody:", requestBody)

	request, err := http.NewRequest("POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		fmt.Println(err)
	}
	request.Header.Add("Authorization", authorizeResponse.AuthorizationToken)

	resp, err := client.Do(request)
	bodyBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(bodyBytes)

	response := new(GetB2LargeUploadStartResponse)
	json.Unmarshal([]byte(bodyBytes), &response)

	return ctx.JSON(http.StatusOK, response)
}

type listLargeFilePartsRequest struct {
	FileID string `json:"fileId"`
}

type FilePart struct {
	FileID        string `json:"fileId"`
	PartNumber    int64  `json:"partNumber"`
	ContentLength int64  `json:"contentLength"`
	ContentSha1   string `json:"contentSha1"`
	ContentMd5    string `json:"contentMd5"`
	//UploadTimestamp time.Time `json:"uploadTimestamp"`
}

type ListLargeFilePartsResponse struct {
	Parts          []FilePart `json:"parts"`
	NextPartNumber int64      `json:"nextPartNumber"`
}

func ListLargeFileParts(ctx echo.Context) error {

	fileID := ctx.Param("fileId")

	authorizeResponse := AuthorizeB2account()

	client := &http.Client{}

	url := authorizeResponse.APIURL + "/b2api/v2/b2_list_parts"

	requestBody := []byte(`{"fileId":"` + fileID + `", "startPartNumber":1, "maxPartCount":1000}`)

	fmt.Println("requestBody:", requestBody)

	request, err := http.NewRequest("POST", url, bytes.NewBuffer(requestBody))
	if err != nil {
		fmt.Println(err)
	}
	request.Header.Add("Authorization", authorizeResponse.AuthorizationToken)

	resp, err := client.Do(request)
	bodyBytes, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Println(string(bodyBytes))

	response := new(ListLargeFilePartsResponse)
	err = json.Unmarshal([]byte(bodyBytes), &response)
	if err != nil {
		log.Fatal(err)
	}

	fmt.Printf("%+v\n", response)

	return ctx.JSON(http.StatusOK, response)
}
