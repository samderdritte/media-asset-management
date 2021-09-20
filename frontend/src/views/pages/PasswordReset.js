
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

// reactstrap components
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardFooter,
  CardTitle,
  FormGroup,
  FormText,
  Form,
  Input,
  Row,
  Col,
} from "reactstrap";

class UserLogin extends React.Component {
  
  constructor(props) {
    super(props);

    this.state = {
      registerEmailState: "",
      resetEmailState: "",
      verifyEmailState: "",
    }
  }
  

  // function that returns true if value is email, false otherwise
  verifyEmail = (value) => {
    var emailRex = /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    if (emailRex.test(value)) {
      return true;
    }
    return false;
  };

  change = (event, stateName) => {

    this.setState({ [stateName]: event.target.value });

    if (this.verifyEmail(event.target.value)) {
      this.setState({ verifyEmailState: "has-success" });
    } else {
      this.setState({ verifyEmailState: "has-danger" });
    }
  };

  resetClick = async () => {
    console.log(this.state.resetEmail);
    const email = this.state.resetEmail;

    const postData = { email };

    try {
      // Login the user in the DB and fetch the jwt token
      const { data } = await axios.post(`/api/users/password/reset`, postData);
      console.log(data)
      this.setState({ resetEmailState: "has-success" });
    } catch (err) {
      console.log(err);
      if (err.response.status === 400) {
        if (err.response.data === "No account with this email has been registered.") {
          if (this.state.resetEmailState === "") {
            this.setState({ resetEmailState: "has-danger" });
          }
        }
      }
    }

  }

  render() {

    if (this.state.tokenExpired) {
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
      resetEmailState,
    } = this.state;
    return (
      <>
        <div className="content">
          <Row>
            <Col md="3">
            </Col>
            <Col md="5">
              <Form id="RegisterValidation">
                <Card>
                  <CardHeader>
                    <CardTitle tag="h4">Reset Password</CardTitle>
                  </CardHeader>
                  <CardBody>
                  <p>Enter your email address below if you want to reset your password.<br/></p>
                  
                    {this.state.resetEmailState !== "has-success" ? (
                      <FormGroup className={`has-label ${resetEmailState}`}>
                        <label>Email Address</label>
                        <Input
                          name="email"
                          type="email"
                          onChange={(e) => {
                            this.change(e, "resetEmail", "email");
                          }}
                        />
                        {this.state.resetEmailState === "has-danger" ? (
                            <label className="error">No user with this email found</label>
                          ) : null}
                      </FormGroup>
                    ) : <FormText><br/>Email sent. Please check your inbox.<br/><br/><br/></FormText>}
                  </CardBody>
                  {this.state.resetEmailState !== "has-success" ? (
                  <CardFooter className="text-right">
                    
                  
                    <Button 
                      disabled={this.state.verifyEmailState !== "has-success"}
                      color="primary" 
                      onClick={this.resetClick} 
                      >
                      Send
                    </Button>
                    
                          
                        
                  </CardFooter>
                  ) : null}
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
