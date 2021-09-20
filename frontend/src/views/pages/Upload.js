
/*

=========================================================
* Paper Dashboard PRO React - v1.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/paper-dashboard-pro-react
* Copyright 2020 Creative Tim (https://www.creative-tim.com)

* Coded by Creative Tim

=========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

*/
import React from "react";
import AuthContext from '../../Context/AuthContext';
import axios from 'axios';
import Dropzone from "react-dropzone";
import exifr from "exifr";
import moment from 'moment';
import crypto from 'crypto';
import * as CryptoJS from 'crypto-js';

// react plugin that creates an input with badges
import TagsInput from "react-tagsinput";
// react plugin used to create datetimepicker
import ReactDatetime from "react-datetime";
// react plugin used to create switch buttons
import Switch from "react-bootstrap-switch";
// react plugin used to create DropdownMenu for selecting items
import Select from "react-select";

import "./Upload.css";

// reactstrap components
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  CardTitle,
  FormGroup,
  Form,
  Input,
  Label,
  Row,
  Col,
} from "reactstrap";

const apiUrl = process.env.REACT_APP_API_URL;

const convertDMSToDD = (degrees, minutes, seconds, direction) => {
  var dd = degrees + minutes/60 + seconds/(60*60);

  if (direction === "S" || direction === "W") {
      dd = dd * -1;
  } // Don't do anything for N or E
  return dd;
}

class Upload extends React.Component {
  constructor() {
    super();
    this.state = {
      files: [],
      fileList: [],
      fileIsDocument: false,
      fileIsVideo: false,
      fileIsImage: false,
      fileIsAudio: false,
      form: {
        date: new Date(),
        tags: [],
        isPublic: false,
        discipline: null,
        location: null,
        venue: null
      },
      b2AuthorizationToken: null,
      b2UploadUrl: null,
    };
  }

  

  generateMetadata = async (file) => {
    
    // Original filename, size, type
    let filename = file.name;
    let filesize = file.size;
    let filetype = file.type;

    let fileInfo = {
      filename,
      filesize,
      filetype,
      meta: null,
      fileIsDocument: false,
      fileIsVideo: false,
      fileIsImage: false,
      fileIsAudio: false,
    }


    const filePrefix = filetype.split('/')[0];
    console.log("filePrefix", filePrefix);
    if (filePrefix === "video") {
      this.setState({fileIsVideo: true});
      fileInfo.fileIsDocument = true;
    }
    if (filePrefix === "audio") {
      this.setState({fileIsAudio: true});
      fileInfo.fileIsVideo = true;
    }
    if (filePrefix === "image") {
      this.setState({fileIsImage: true});
      fileInfo.fileIsImage = true;
    }
    if (filePrefix === "application" || filePrefix === "text") {
      this.setState({fileIsDocument: true});
      fileInfo.fileIsDocument = true;
    }

    const imageTypes = ["image/png", "image/jpeg", "image/tiff"]
    if (imageTypes.includes(filetype)) {
      let metadata = await exifr.parse(file);

      // Create Date
      let createDate = null;
      if (metadata.CreateDate) {
        createDate = metadata.CreateDate;
      }
      // Modify Date
      let modifyDate = null;
      if (metadata.ModifyDate) {
        modifyDate = metadata.ModifyDate;
      }

      // Geodata
      let latitude = null;
      let longitude = null;
      if (metadata.latitude & metadata.longitude) {
        latitude = metadata.latitude;
        longitude = metadata.longitude;
      }
      let GPSDestBearing = null;
      let GPSDestBearingRef = null;
      if (metadata.GPSDestBearing && metadata.GPSDestBearingRef) {
        GPSDestBearing = metadata.GPSDestBearing;
        GPSDestBearingRef = metadata.GPSDestBearingRef;
      }
      // Make and model
      let make = null;
      if (metadata.Make) {
        make = metadata.Make;
      }
      let model = null;
      if (metadata.Model) {
        make = metadata.Model;
      }
      // Image height and width
      let height = null;
      let width = null
      if (metadata.ExifImageHeight && metadata.ExifImageWidth) {
        height = metadata.ExifImageHeight;
        width = metadata.ExifImageWidth;
        
      } else if (metadata.ImageHeight && metadata.ImageWidth) {
        height = metadata.ImageHeight;
        width = metadata.ImageWidth;
      }

      // Image Resolution
      let XResolution = null;
      let YResolution = null;
      if (metadata.XResolution && metadata.YResolution) {
        XResolution = metadata.XResolution;
        YResolution = metadata.YResolution;
      }
      
      // Orientation
      let orientation = null;
      if (metadata.Orientation) {
        orientation = metadata.Orientation;
      }

      const imageMeta = {
        filename,
        filesize,
        filetype,
        createDate,
        modifyDate,
        latitude,
        longitude,
        GPSDestBearing,
        GPSDestBearingRef,
        make,
        model,
        height,
        width,
        XResolution,
        YResolution,
        orientation
      }

      fileInfo.meta = imageMeta;
    }
    
    console.log(fileInfo);
    
    // calculate parts and sha1 hash

    const partSize = 75000000;
    //const partSize = 20000000;
    const numParts = Math.ceil(file.size / partSize);
    console.log("numParts",numParts);
    const partsList = [];
    const sha1array = [];

    const partsArray = Array(numParts).map(x => 0);
    console.log("partsArray",partsArray);
    for (let start = 0; start < file.size; start += partSize) {
      let part = file.slice(start, start + partSize, file.type);
      partsList.push(part);
      let reader = new FileReader();
      reader.onload = () => {
        let hash = CryptoJS.SHA1(CryptoJS.enc.Latin1.parse(reader.result));
        sha1array.push(CryptoJS.enc.Hex.stringify(hash));
        partsArray[start/partSize] = CryptoJS.enc.Hex.stringify(hash);
      }
      reader.readAsBinaryString(part);
    }
    
    
    console.log("partsArray",partsArray);

    let singleFile = {
      file: file,
      fileInfo: fileInfo,
      numParts: numParts,
      partsList: partsList,
      sha1array: partsArray
    }
    this.setState({ fileList: [...this.state.fileList, singleFile] })

  }

  onDrop = (files) => {

    files.forEach(file => {
      console.log(file.name);
      this.generateMetadata(file);      
    })
  }

  handleRemoveFromFileList = (file) => {
    console.log(file);

    let fileList = [...this.state.fileList];
    let index = fileList.indexOf(file);
    if (index !== -1) {
      fileList.splice(index, 1);
      this.setState({fileList: fileList});
    }
  }

  handleDateChange = (date) => {
    console.log(date.format('YYYY-MM-DD'));

    let newDate = new Date(date);
    this.setState({form: {date: newDate}})

  }

  getUploadUrl = async () => {
    // Get the upload url from b2
    try {
      const { data } = await axios.get('/api/secure/media/upload/authorize')
      console.log(data);
      const result = {
        b2UploadUrl: data.uploadUrl,
        b2AuthorizationToken: data.authorizationToken
      }
      return result;

    } catch(err) {
      console.log(err)
    }
  }

  uploadFileInfoToDatabase = async (response, file) => {

    // Check if the file still exists, to make sure that
    // the metadata is stored in the DB only once
    if(file) {     
      const bodyData = {};
      bodyData.b2fileId = response.fileId;
      bodyData.b2fileName = response.fileName;
      bodyData.b2ContentType = response.contentType;
      bodyData.b2FileSize = response.contentLength;
      bodyData.metadata = file.fileInfo.meta;
      bodyData.lastModifiedDate = file.file.lastModifiedDate;
      bodyData.fileInfo = this.state.form;
      console.log("bodyData", bodyData)
      try {
        const { data } = await axios.post('/api/secure/media/db/upload/', bodyData);
        console.log(data);

      } catch(err) {
        console.log(err);
      }
    }
    
  }

  uploadFile = async (file) => {
    try {     
      const { data } = await axios.get('/api/secure/media/upload/authorize');
      console.log("auth: ",data);
      
      /*
      const { uploadUrl, authorizationToken } = data;
      console.log(uploadUrl);
      try {
        const b2axios = axios.create()
        const { data } = await b2axios.post('https://cors-anywhere.herokuapp.com/'+uploadUrl, data: file.file, {
          headers: {
            "Content-Type": file.file.type,
            "Authorization":  authorizationToken,
            "X-Bz-File-Name": encodeURI(file.file.name),
            "X-Bz-Content-Sha1": file.sha1array[0]
          }, 
          
          onUploadProgress : (progressEvent) => {
            const { loaded, total } = progressEvent;
            let percent = Math.floor( loaded * 100  / total );
            console.log(`${loaded}kb of ${total}kb | ${percent}%`)
          }
        })
      } catch(err) {
        console.log(err);
      }

      */

      /*
      fetch(data.uploadUrl, {
        method: 'POST',
        headers: {
          "Content-Type": file.file.type,
          "Authorization":  data.authorizationToken,
          "X-Bz-File-Name": encodeURI(file.file.name),
          "X-Bz-Content-Sha1": file.sha1array[0]
        },
        body: file.file
      }).then(
        response => response.json()
      ).then(
        success => {
          console.log("File successfully uploaded to B2 storage: ",file.file.name);
          this.uploadFileInfoToDatabase(success, file);
        }

      ).catch(
        error => console.log(error)
      );
      
      */
      let xhr = new XMLHttpRequest();
      xhr.open('POST', data.uploadUrl);
      console.log('OPENED', xhr.status);

      xhr.onprogress = () => {
        console.log('LOADING', xhr.status);
      };
      
      xhr.upload.onprogress = (event) => {
        console.log(`Uploaded ${event.loaded} of ${event.total} bytes`);
      };

      xhr.onload = () => {
          console.log('DONE', xhr.status);
          console.log(xhr.response);
          this.uploadFileInfoToDatabase(xhr.response, file);
      };
      
      xhr.setRequestHeader("Content-Type", file.file.type);
      xhr.setRequestHeader("Authorization",  data.authorizationToken);
      xhr.setRequestHeader("X-Bz-File-Name", encodeURI(file.file.name));
      xhr.setRequestHeader("X-Bz-Content-Sha1", file.sha1array[0]);


      xhr.send(file.file);

    } catch(err) {
      console.log(err)
    }
  }

  uploadLargeFile = async (file) => {
    console.log("file ",file.file.name, " is too big.")

    // the array of sha1 checksums needs to be uploaded at the end of the upload
    
    let partNum = 0;
    let fileId = null;
    try {
      // start the large file upload
      const filename = encodeURI(file.file.name);
      const contentType = file.file.type;
      const { data } = await axios.get(`/api/secure/media/upload/large/start/?filename=${filename}&contentType=${contentType}`);
      console.log("auth: ",data);
      fileId = data.fileId;

    } catch(err) {
      console.log(err);
    }

    console.log("fileId",fileId);
    console.log(file.partsList);
    console.log(file.sha1array);

    for (let i=0; i<file.partsList.length; i++){
      partNum++
    
      try {
        // Get the upload url for the large file      
        let { data } = await axios.get(`/api/secure/media/upload/large/getUrl/${fileId}`);
        console.log("getUrl data: ",data);
        
        let xhr = new XMLHttpRequest();
        xhr.open('POST', data.uploadUrl);
        console.log('OPENED', xhr.status);

        xhr.onprogress = function () {
          console.log('LOADING', xhr.status);
        };
      
        xhr.upload.onprogress = (event) => {
          console.log(`Uploaded ${event.loaded} of ${event.total} bytes`);
        };
        
        xhr.onload = () => {
            console.log('DONE', xhr.status);
            this.checkLargeFilePartsList(file, fileId, file.sha1array);
        };
        
        xhr.setRequestHeader("Content-Type", file.file.type);
        xhr.setRequestHeader("Authorization",  data.authorizationToken);
        xhr.setRequestHeader("X-Bz-Part-Number", partNum);
        xhr.setRequestHeader("X-Bz-File-Name", encodeURI(file.file.name));
        xhr.setRequestHeader("X-Bz-Content-Sha1", file.sha1array[i]);


        xhr.send(file.partsList[i]);
        
        /*
        fetch(data.uploadUrl, {
              method: 'POST',
              headers: {
                "Content-Type" : file.file.type,
                "Content-Length" : file.partsList[i].size,
                "Authorization" :  data.authorizationToken,
                "X-Bz-Part-Number" : partNum,
                "X-Bz-File-Name" : encodeURI(file.file.name),
                "X-Bz-Content-Sha1" : file.sha1array[i]
              },
              body: file.partsList[i]
            }).then(
              response => response.json()
            ).then(
              success => {
                console.log(success); 
                this.checkLargeFilePartsList(file, fileId, file.sha1array);
              }
            ).catch(
              error => console.log(error)
            );
          */
      }
      catch(err) {
        console.log(err);
      }
    }
    
  }
  
  checkLargeFilePartsList = async (file, fileId, sha1array) => {
    console.log("checking uploaded parts of large file ...", fileId)
    
    // check if all parts have been uploaded
    try {
      const { data } = await axios.get(`/api/secure/media/upload/large/listParts/${fileId}`);
      console.log("listParts response:", data);
      if(data.parts.length === sha1array.length){
        this.finishLargeFile(file, fileId, sha1array);
      }
    } catch(err) {
      console.log(err)
    }
  }

  finishLargeFile = async (file, fileId, sha1array) => {
    console.log("finishing large file upload...")
    // finish large file upload
    let bodyData = { fileId: fileId, partSha1Array: sha1array};
    console.log(JSON.stringify(bodyData));
    try {
      const { data } = await axios.post(`/api/secure/media/upload/large/finish/`, bodyData);
      console.log(data);
      this.uploadFileInfoToDatabase(data, file);
    } catch(err) {
      console.log(err);
    } 
  }

  uploadFilesClick = async () => {
    console.log("Uploading Files");
   
    this.state.fileList.forEach(file => {

      // Check for big files
      // If a file is >100MB, then use large file upload
      if(file.file.size > 100000000) {
      //if(file.file.size > 10000000) {
        this.uploadLargeFile(file);
      } else if (file.file.size > 1000000000000)  {
        // TODO in this case we need to adjust the partSize since max number of parts is 10'000
        console.log("File is too big to upload.")
      } else {
        this.uploadFile(file);
      }
      
    })

    this.setState({
      //b2UploadUrl: null,
      //b2AuthorizationToken: null,
      fileList: []
    })
  }

  render() {
    console.log(this.state);
    const files = this.state.fileList.map((file, i) => (
      <li key={file.file.name + i} >
        {file.file.name} - {file.file.size} bytes 
        <span className="file-remove" color="danger" onClick={() => this.handleRemoveFromFileList(file)}>
        <i className="nc-icon nc-simple-remove" />
        </span>
          
        
      </li>
    ));

    if (this.state.fileList !== null) {

        console.log("fileList",this.state.fileList);
      
      
    }
    
    
    return (
      <>
        <div className="content">
          <Card>
            <CardHeader>
             <h5 className="title">File Upload</h5>
            </CardHeader>
            <CardBody>
              <Dropzone onDrop={this.onDrop}>
                {({getRootProps, getInputProps}) => (
                  <section className="dropzoneContainer">
                    <div {...getRootProps({className: 'dropzone'})}>
                      <input {...getInputProps()} />
                      <p className="dropzoneText">Drag 'n' drop some files here, or click to select files</p>
                    </div>
                    <aside>
                      
                    </aside>
                  </section>
                )}
              </Dropzone>
              <CardTitle tag="h4">Metadata</CardTitle>
              <p>
                Metadata are set for all uploaded files. If you wish to add different tags for each file, upload the file(s) individually.
              </p>
              <Form className="form-horizontal">
                    <Row>
                      <Label md="1">Public</Label>
                      <Col md="9">
                        <FormGroup>
                        <Switch
                          defaultValue={false}
                          onChange={(value) => {
                            console.log(value);
                            let form = {...this.state.form};
                            form.isPublic = value.state.value;
                            this.setState({form});
                            }
                          }
                          offColor="success"
                          offText={<i className="nc-icon nc-simple-remove" />}
                          onColor="success"
                          onText={<i className="nc-icon nc-check-2" />}
                        />
                        </FormGroup>
                      </Col>
                    </Row>
                    <Row>
                      <Label md="1">Date</Label>
                      <Col md="3">
                        <FormGroup>
                        <ReactDatetime
                          onChange={(value) => {
                            let newDate = new Date(value);
                            let form = {...this.state.form};
                                
                            form.date = newDate;
                            this.setState({form})
                            }
                          }
                          value={moment(this.state.form.date).format('MMMM Do YYYY')}
                          inputProps={{
                            className: "form-control",
                            placeholder: "Date Picker Here",
                          }}
                          timeFormat={false}
                        />
                        </FormGroup>
                      </Col>
                    </Row>
                    <Row>
                      <Label md="1">Tags</Label>
                      <Col md="3">
                        <FormGroup>
                          <TagsInput
                            value={this.state.form.tags}
                            onChange={(value) => {
                                let form = {...this.state.form};
                                form.tags = value;
                                this.setState({ form })
                                }
                            }
                            tagProps={{ className: "react-tagsinput-tag info" }}
                          />
                        </FormGroup>
                      </Col>
                    </Row>
                    <Row>
                      <Label md="1">Discipline</Label>
                      <Col md="3">
                        <FormGroup>
                        <Select
                            className="react-select primary"
                            classNamePrefix="react-select"
                            name="singleSelect"
                            value={this.state.form.discipline}
                            onChange={(value) => {
                              let form = {...this.state.form};
                              form.discipline = value;
                              this.setState({ form })
                            }
                              
                            }
                            options={[
                              {
                                value: "",
                                label: "Choose",
                                isDisabled: true,
                              },
                              { value: "biathlon", label: "Biathlon" },
                              { value: "curling", label: "Curling" },
                              { value: "eishockey", label: "Eishockey" },
                              { value: "eiskunstlauf", label: "Eiskunstlauf" },
                              { value: "freestyleSkiing", label: "Freestyle Skiing" },
                              { value: "langlauf", label: "Langlaug" },
                              { value: "shortTrack", label: "Short Track" },
                              { value: "skiAlpin", label: "Ski Alpin" },
                              { value: "snowboard", label: "Snowboard" },
                              { value: "skiOrientierungslauf", label: "Ski-Orientierungslauf" }
                            ]}
                            placeholder="Choose"
                          />
                        </FormGroup>
                      </Col>
                    </Row>
                    <Row>
                      <Label md="1">Location</Label>
                      <Col md="3">
                        <FormGroup>
                        <Select
                            className="react-select primary"
                            classNamePrefix="react-select"
                            name="singleSelect"
                            value={this.state.form.location}
                            onChange={(value) => {
                              let form = {...this.state.form};
                              form.location = value;
                              this.setState({ form })
                              }
                            }
                            options={[
                              {
                                value: "",
                                label: "Choose",
                                isDisabled: true,
                              },
                              { value: "andermattRealp", label: "Andermatt-Realp" },
                              { value: "engelberg", label: "Engelberg" },
                              { value: "lenzerheide", label: "Lenzerheide" },
                              { value: "luzern", label: "Luzern" },
                              { value: "stoos", label: "Stoos" },
                              { value: "sursee", label: "Sursee" },
                              { value: "zug", label: "Zug" },
                            ]}
                            placeholder="Choose"
                          />
                        </FormGroup>
                      </Col>
                    </Row>
                    <Row>
                      <Label md="1">Venue</Label>
                      <Col md="3">
                        <FormGroup>
                        <Select
                            className="react-select primary"
                            classNamePrefix="react-select"
                            name="singleSelect"
                            value={this.state.form.venue}
                            onChange={(value) => {
                              let form = {...this.state.form};
                              form.venue = value;
                              this.setState({ form })
                              }
                            }
                            options={[
                              {
                                value: "",
                                label: "Choose",
                                isDisabled: true,
                              },
                              { value: "nordischenZentrumRealp", label: "Nordischen Zentrum Realp" },
                              { value: "jochpass2222", label: "Jochpass 2222" },
                              { value: "sportingPark", label: "Sporting Park" },
                              { value: "biathlonArena", label: "Biathlon Arena" },
                              { value: "rez", label: "REZ" },
                              { value: "franzHeinzerPiste", label: "Franz-Heinzer-Piste" },
                              { value: "maggiwald", label: "Maggiwald" },
                              { value: "regionalesEiszentrumSursee", label: "Regionales Eiszentrum Sursee" },
                              { value: "bossardArena", label: "Bossard Arena" },
                            ]}
                            placeholder="Choose"
                          />
                        </FormGroup>
                      </Col>
                    </Row>
                    {this.state.fileIsVideo && 
                      <Row>
                      <Label md="1">Video Category</Label>
                      <Col md="3">
                        <FormGroup>
                        <Select
                            className="react-select primary"
                            classNamePrefix="react-select"
                            name="singleSelect"
                            value={this.state.form.videoCategory}
                            onChange={(value) => {
                              let form = {...this.state.form};
                              form.videoCategory = value;
                              this.setState({ form })
                              }
                             
                            }
                            options={[
                              {
                                value: "",
                                label: "Choose",
                                isDisabled: true,
                              },
                              { value: "fisuNews", label: "FISU News" },
                              { value: "fisuHighlights", label: "FISU Highlights" },
                            ]}
                            placeholder="Choose"
                          />
                        </FormGroup>
                      </Col>
                    </Row>
                    }
              </Form>
              
              
              
              <h4>Files</h4>
                      <ul className="file-list">{files}</ul>
            </CardBody>
            <CardFooter>
              <Button 
                //disabled={this.state.b2AuthorizationToken === null}
                color="primary" 
                onClick={this.uploadFilesClick
                }>
                Upload
              </Button>
            </CardFooter>
          </Card>
        </div>
      </>
    );
  }
}

Upload.contextType = AuthContext;

export default Upload;
