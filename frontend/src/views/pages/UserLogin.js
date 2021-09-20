
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
  Form,
  Input,
  Row,
  Col,
} from "reactstrap";

class UserLogin extends React.Component {
  
  constructor(props) {
    super(props);
    this.state = {
      // login form
      loginFullName: "",
      loginEmail: "",
      loginPassword: "",
      loginFullNameState: "",
      loginEmailState: "",
      loginPasswordState: "",
    }
  }

  change = (event, stateName) => {
    this.setState({ [stateName]: event.target.value }); 
  };

  loginClick = async (e) => {
    e.preventDefault();
    console.log("login clicked")

    const email = this.state.loginEmail;
    const password = this.state.loginPassword;
    const postData = { email, password};
    this.setState({ loginEmailState: "" });
    this.setState({ loginPasswordState: "" });
    try {
      // Login the user in the DB and fetch the jwt token
      const { data } = await axios.post(`/api/users/login`, postData);
      console.log("Login successful", data)
      try {
        // If the user is authenticated, then fetch his user data from the DB
        const { data } = await axios.get(`/api/secure/users/current`);
        // Login and store user data in Context
        this.context.logIn(data)
        console.log("User data fetched.")

        // On successful login, go to the dashboard page
        this.props.history.push("/admin/dashboard");

      } catch(err) {
          console.log(err)
        }
    } catch (err) {
      console.log(err);
      // If the user is not registered, then the server will return a 400 error
      if (err.response.status === 400) {
        if (err.response.data === "No account with this email has been registered.") {
          if (this.state.loginEmailState === "") {
            this.setState({ loginEmailState: "has-danger" });
          }
        } 
      // If the user enters a wrong password, then the server will return a 401 error
      } else if (err.response.status === 401) {
        if (err.response.data === "Please provide valid credentials") {
          if (this.state.loginPasswordState === "") {
            this.setState({ loginPasswordState: "has-danger" });
          }
        }
      }  
    }
  };

  render() {
    
    let {
      // login form
      loginEmailState,
      loginPasswordState,
    } = this.state;
    return (
      <>
        <div className="content">
          <Row>
            <Col md="3">
            </Col>
            <Col md="5">
              <Form id="LoginValidation" onSubmit={this.loginClick}>
                  <Card>
                    <CardHeader>
                      <CardTitle tag="h4">Login</CardTitle>
                    </CardHeader>
                    <CardBody>
                      <FormGroup className={`has-label ${loginEmailState}`}>
                        <label>Email Address *</label>
                        <Input
                          name="email"
                          type="email"
                          onChange={(e) => this.change(e, "loginEmail")}
                        />
                        {this.state.loginEmailState === "has-danger" ? (
                          <label className="error">
                            Please enter a valid email address.
                          </label>
                        ) : null}
                      </FormGroup>
                      <FormGroup className={`has-label ${loginPasswordState}`}>
                        <label>Password *</label>
                        <Input
                          name="password"
                          type="password"
                          autoComplete="off"
                          onChange={(e) =>
                            this.change(e, "loginPassword")
                          }
                        />
                        {this.state.loginPasswordState === "has-danger" ? (
                          <label className="error">Invalid Password.</label>
                        ) : null}
                      </FormGroup>
                      <div className="category form-category">
                        * Required fields
                      </div>
                    </CardBody>
                    <CardFooter className="text-center">
                      <Button type="submit" color="primary">
                        Login
                      </Button>
                      <div className="category form-category">
                        <br/>
                        <a href="/admin/password-reset">Forgot password?</a>
                      </div>
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
