/*!

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
// react plugin for creating notifications over the dashboard
import NotificationAlert from "react-notification-alert";
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
  Col,
} from "reactstrap";

import axios from 'axios';

class UserCreate extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      // register form
      registerEmail: "",
      registerEmailState: ""
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

  change = (event) => {
    this.setState({ registerEmail: event.target.value }); 
    if (this.verifyEmail(event.target.value)) {
      this.setState({ registerEmailState: "has-success" });
    } else {
      this.setState({ registerEmailState: "has-danger" });
    }
  }

  notify = (place, type, icon, msg) => {
    var options = {};
    options = {
      place: place,
      message: ( 
        <div>
          <span
            data-notify="icon"
            className={icon}
          />
          <span>
            {msg}
          </span>
        </div>
      ),
      type: type,
      autoDismiss: 3,
    };
    this.refs.notificationAlert.notificationAlert(options);
  };


  registerClick = async (e) => {
    e.preventDefault();
    const email = this.state.registerEmail;
    const postData = { email};
    e.target.reset();
    try {
      const { data } = await axios.post(`/api/secure/users/create`, postData);
      this.notify("br", "success", "nc-icon nc-check-2", "User created.");
      this.props.history.push(`/admin/user-edit/${data.id}`);
    } catch(err) {
      console.log(err);
      if (err.response.status === 400) {
        if (err.response.data === "User with the same email already exists.") {
          this.notify("br", "danger", "nc-icon nc-simple-remove", "User with the same email already exists.");
          
        } 
      }
    }
    
  }

  render() {
    let { registerEmailState } = this.state;
    // Get user data from context
    //let { name, surname, email, address, city, country, zipCode, role } = ""
    //let permissions = ["Media", "Documents", "Organizing Commitee"]
    
    return (
      <>
        <NotificationAlert ref="notificationAlert" className="alert-with-icon" />
        <div className="content">
        <Col md="6">
            <Form id="RegisterValidation" onSubmit={this.registerClick}>
              <Card>
                <CardHeader>
                  <CardTitle tag="h4">Create User</CardTitle>
                </CardHeader>
                <CardBody>
                  To create a new user, click the button below and we will send an email
                  with instructions to set a password.<br/><br/>
                  <FormGroup className={`has-label ${registerEmailState}`}>
                    
                    <Input
                      name="email"
                      type="email"
                      onChange={(e) =>
                        this.change(e, "registerEmail", "email")
                      }
                    />
                    {this.state.registerEmailState === "has-danger" ? (
                      <label className="error">
                        Please enter a valid email address.
                      </label>
                    ) : null}
                  </FormGroup>
                  
                </CardBody>
                <CardFooter className="text-right">
                  <Button 
                    color="primary" 
                    type="submit"
                    disabled={this.state.registerEmailState !== "has-success"}
                  >
                    Register
                  </Button>
                </CardFooter>
              </Card>
            </Form>
          </Col>
          
        </div>
      </>
    );
  }
}
UserCreate.contextType = AuthContext;

export default UserCreate;
