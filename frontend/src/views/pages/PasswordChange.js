

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
// react component used to create sweet alerts
import ReactBSAlert from "react-bootstrap-sweetalert";

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
  Row,
  Col,
} from "reactstrap";

const parseJwt = (token) => {
  try {
    return JSON.parse(atob(token.split('.')[1]));
  } catch (e) {
    return null;
  }
};

class UserLogin extends React.Component {
  
  constructor(props) {
    super(props);
    
    // Parse the user from the jwt token
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const token = urlParams.get('token'); 
    
    if (token !== null) {
      const parsed = parseJwt(token);
      // Check whether the token is expired
      const date = new Date(parsed.exp * 1000);
      const isExpired = date < new Date()
      this.state = {
        alert: null,
        email: parsed.email,
        token: token,
        tokenExpired: isExpired,
        registerEmailState: "",
        registerPasswordState: "",
        registerConfirmPasswordState: "",
        minLengthState: ""
      }
    }
    
    
  }
  
  // function that verifies if a string has a given length or not
  verifyLength = (value, length) => {
    if (value.length >= length) {
      return true;
    }
    return false;
  };
  // function that verifies if two strings are equal
  compare = (string1, string2) => {
    if (string1 === string2) {
      return true;
    }
    return false;
  };

  change = (event, stateName, type, stateNameEqualTo, maxValue) => {
    switch (type) {
      case "password":
        if (this.verifyLength(event.target.value, 1)) {
          this.setState({ [stateName + "State"]: "has-success" });
        } else {
          this.setState({ [stateName + "State"]: "has-danger" });
        }
        break;
      case "equalTo":
        if (this.compare(event.target.value, this.state[stateNameEqualTo])) {
          this.setState({ [stateName + "State"]: "has-success" });
          this.setState({ [stateNameEqualTo + "State"]: "has-success" });
        } else {
          this.setState({ [stateName + "State"]: "has-danger" });
          this.setState({ [stateNameEqualTo + "State"]: "has-danger" });
        }
        break;
      case "length":
        if (this.verifyLength(event.target.value, stateNameEqualTo)) {
          this.setState({ [stateName + "State"]: "has-success" });
        } else {
          this.setState({ [stateName + "State"]: "has-danger" });
        }
        break;
      default:
        break;
    }
    this.setState({ [stateName]: event.target.value });

    
  };

  hideAlert = () => {
    this.setState({
      alert: null,
    });
  };

  successAlert = () => {
    console.log("alert")
    this.setState({
      alert: (
        <ReactBSAlert
          success
          style={{ display: "block", marginTop: "-100px" }}
          title="Password changed"
          onConfirm={() => this.hideAlert()}
          onCancel={() => this.hideAlert()}
          confirmBtnBsStyle="info"
          btnSize=""
        >
          You can now login with your new password
        </ReactBSAlert>
      ),
    });
  };

  changePasswordClick = async () => {

    const password = this.state.registerPassword;
    const confirmPassword = this.state.registerConfirmPassword;
    const token = this.state.token;
    const postData = { password, confirmPassword };
    console.log(postData);

    
    const config = {
      headers: { Authorization: `Bearer ${token}` }
    }
    try {
      // Login the user in the DB and fetch the jwt token
      const { data } = await axios.post(`/api/header/users/password/change`, postData, config);
      console.log(data)
      this.successAlert();
      // On successful login, go to the dashboard page
      this.props.history.push("/admin/user-login");
      

    } catch (err) {
      console.log(err);
      
      
    }  
      
  };

  render() {
    console.log(this.state);
    if (this.state === null || this.state.tokenExpired) {
      return (
        <div className="content">
          <Row>
            <Col md="3">
            </Col>
            <Col md="5">
              <Card>
                  <CardHeader>
                    <CardTitle tag="h4">This Link is no longer valid.</CardTitle>
                  </CardHeader>
                  <CardBody>
                    Please request a new link or contact an administrator.
                  </CardBody>
              </Card>
            </Col>
          </Row>
        </div>
      )
    }
    
    let {
      // login form
      registerEmailState,
      registerConfirmPasswordState,
      minLengthState
    } = this.state;
    return (
      <>
        <div className="content">
          {this.state.alert}
          <Row>
            <Col md="3">
            </Col>
            <Col md="5">
              <Form id="RegisterValidation">
                <Card>
                  <CardHeader>
                    <CardTitle tag="h4">Change Password</CardTitle>
                  </CardHeader>
                  <CardBody>
                    <FormGroup className={`has-label ${registerEmailState}`}>
                      <label>Email Address</label>
                      <Input
                        disabled
                        name="email"
                        type="email"
                        defaultValue={this.state.email}
                      />
                    </FormGroup>
                    <FormGroup className={`has-label ${minLengthState}`}>
                      <label>Password</label>
                      <Input
                        id="registerPassword"
                        name="password"
                        type="password"
                        autoComplete="off"
                        onChange={(e) => {
                          this.change(e, "minLength", "length", 10);
                          this.change(e, "registerPassword", "password");
                          this.change(
                            e,
                            "registerConfirmPassword",
                            "equalTo",
                            "registerPassword"
                          )
                        }
                          
                        }
                      />
                      {this.state.minLengthState === "has-danger" ? (
                            <label className="error">
                              Please enter at least 10 characters.
                            </label>
                          ) : null}
                    </FormGroup>
                    <FormGroup
                      className={`has-label ${registerConfirmPasswordState}`}
                    >
                      <label>Confirm Password</label>
                      <Input
                        equalto="#registerPassword"
                        id="registerPasswordConfirmation"
                        name="password_confirmation"
                        type="password"
                        autoComplete="off"
                        onChange={(e) =>
                          this.change(
                            e,
                            "registerConfirmPassword",
                            "equalTo",
                            "registerPassword"
                          )
                        }
                      />
                      {this.state.registerConfirmPasswordState ===
                      "has-danger" ? (
                        <label className="error">Passwords do not match.</label>
                      ) : null}
                    </FormGroup>
                  </CardBody>
                  <CardFooter className="text-right">
                    <Button 
                      color="primary" 
                      onClick={this.changePasswordClick} 
                      /*disabled={!(this.state.minLengthState === "has-success" && 
                      this.state.registerConfirmPasswordState === "has-success"
                      && this.state.registerPasswordState === "has-success")
                      }*/>
                      Save
                    </Button>
                  </CardFooter>
                </Card>
              </Form>
            </Col>
          </Row>
        </div>
      </>
    );
  }
}

UserLogin.contextType = AuthContext;

export default UserLogin;
