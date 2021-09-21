
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
// react plugin used to create DropdownMenu for selecting items
import Select from "react-select";
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
  Label,
  Row,
  Col,
} from "reactstrap";

import axios from 'axios';

const apiUrl = process.env.REACT_APP_API_URL

class UserEdit extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      // login form
      _id: this.props.match.params.id,
      userDataFetched: false,
      userRolesListFetched: false,
      userRolesList: [],
      email: "",
      name: "",
      surname: "",
      address: "",
      city: "",
      country: "",
      zip_code: "",
      role: "",
      roleSelect: null,
      permissions: [],
      permissionsSelect: [],
      disableIfNotAdmin: true
    }
  }

  componentDidMount = () => {
    const isLoggedIn = localStorage.getItem("isLoggedIn");

    if (!isLoggedIn || isLoggedIn === "false") {
      // if the user is not logged in, redirect back to dashboard
      this.props.history.push("/admin/dashboard");
    } else if (isLoggedIn === "true" && this.context.user === null) {
      
      // TODO: Catch the case when the jwt token has exired, but local storage login flag is still set to true
      
      //this.props.history.push("/admin/dashboard");
      //localStorage.setItem("isLoggedIn", "false")
    }

    this.fetchUserRolesList();
    this.fetchUserPermissionsList();

  }

  componentDidUpdate = () => {
    if(this.context.user && !this.state.userRolesListFetched) {
      this.fetchUserRolesList();
    }
    if(this.context.user && !this.state.userPermissionsListFetched) {
      this.fetchUserPermissionsList();
    }

    if(this.context.user && this.state.userRolesListFetched && !this.state.userDataFetched) {
      this.fetchUserDataById(this.state._id);
    }
    
  }

  notify = (place, type, msg) => {
    var options = {};
    options = {
      place: place,
      message: ( 
        <div>
          <span
            data-notify="icon"
            className="nc-icon nc-check-2"
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

  change = (event, stateName) => { 
    this.setState({ [stateName]: event.target.value }, () => {console.log(this.state)});
  };

  updateClick = async () => {
    console.log(this.state)
    
    try {
      // Fetch the user roles from the DB
      const updateValues = {
        _id: this.state._id,
        email: this.state.email,
        name: this.state.name,
        surname: this.state.surname,
        address: this.state.address,
        zip_code: this.state.zipCode,
        city: this.state.city,
        country: this.state.country,
        role: this.state.role,
        permissions: this.state.permissions
      }
      const response = await axios.put(`/api/secure/users/update`, updateValues);
      console.log(response);
      this.context.refreshUserData();
      this.notify("br", "success", "Profile updated.");
      console.log(this.context);
    } catch(err) {
      console.log(err)
    }
    
  }

  fetchUserDataById = async (_id) => {
    console.log("Collecting user data for profile form.")

    try {
      // Fetch the user roles from the DB
      const { data } = await axios.get(`/api/secure/users/${_id}`);
      
      console.log("data",data);
      if(this.state.userRolesListFetched && this.state.userPermissionsListFetched) {
        // set the user's role dropdown
        let roleValue = data.role;
        let roleLabel = this.state.userRolesList.find(obj => {
          return obj.value === roleValue;
        });
        // set the user's permissions dropdown
        let permissionsSelect = [];
        if(data.permissions != null && data.permissions.length > 0) {
          data.permissions.forEach(perm => {
            console.log("perm",perm)
            let lookupValue = this.state.userPermissionsList.find(obj => {
              return obj.value === perm;
            })
            let dropdownElem = {value: perm, label: lookupValue.label}
            permissionsSelect.push(dropdownElem);
          })
        }
        
        this.setState({ 
          userDataFetched: true,
          email: data.email,
          name: data.name,
          surname: data.surname,
          address: data.address,
          city: data.city,
          country: data.country,
          zipCode: data.zip_code,
          role: data.role,
          roleSelect: {value: roleValue, label: roleLabel.label},
          permissions: data.permissions,
          permissionsSelect: permissionsSelect,
          disableIfNotAdmin: !data.is_admin,
          disableIfOwnProfile: data._id === this.context.user._id
        });

      }
    } catch(err) {
      console.log(err)
    }
  }

  fetchUserRolesList = async () => {
    console.log("Fetching user roles from database.")
    try {
      // Fetch the user roles from the DB
      const { data } = await axios.get(`${apiUrl}/api/secure/users/roles/list`);
      const roles = data.map((role) => {return {value: role.name, label: role.label} })
      this.setState({
        userRolesList: roles,
        userRolesListFetched: true
      });

    } catch(err) {
      console.log(err)
    }
  }

  fetchUserPermissionsList = async () => {
    console.log("Fetching user permissions from database.")
    try {
      // Fetch the user roles from the DB
      const { data } = await axios.get(`${apiUrl}/api/secure/users/permissions/list`);
      const permissions = data.map((perm) => {return {value: perm.name, label: perm.label} })
      this.setState({
        userPermissionsList: permissions,
        userPermissionsListFetched: true
      });

    } catch(err) {
      console.log(err)
    }
  }

  render() {
    // Get user data from context
    if (!this.context.user) {
      return (
        <div className="content">
          <Row>
            <Col md="3">
            </Col>
            <Col md="5">
              <Card>
                  <CardHeader>
                    <CardTitle tag="h4">You are not authorized to view this site.</CardTitle>
                  </CardHeader>
                  <CardBody>
                    Please contact an administrator if you think you should have access.
                  </CardBody>
              </Card>
            </Col>
          </Row>
        </div>
      )
    }
    if (this.context.user.is_admin) {
      return (
        <>
          <NotificationAlert ref="notificationAlert" className="alert-with-icon" />
          <div className="content">
            <Row>
              <Col md="2"></Col>
              <Col md="8">
                <Card>
                  <CardHeader>
                    <h5 className="title">Edit User</h5>
                  </CardHeader>
                  <CardBody>
                    <Form>
                      <Row>
                        <Col className="pr-1" md="6">
                          <FormGroup>
                            <label>Email address</label>
                            <Input
                              name="email"
                              defaultValue={this.state.email}
                              disabled
                              placeholder="Email address"
                              type="email"
                            />
                          </FormGroup>
                        </Col> 
                      </Row>
                      <Row>
                        <Col className="pr-1" md="6">
                          <FormGroup>
                            <label>First Name</label>
                            <Input
                              name="name"
                              defaultValue={this.state.name}
                              placeholder="First Name"
                              type="text"
                              onblur={(e) => this.change(e, "name")}
                            />
                          </FormGroup>
                        </Col>
                        <Col className="pl-1" md="6">
                          <FormGroup>
                            <label>Last Name</label>
                            <Input
                              defaultValue={this.state.surname}
                              placeholder="Last Name"
                              type="text"
                              onblur={(e) => this.change(e, "surname")}
                            />
                          </FormGroup>
                        </Col>
                      </Row>
                      <Row>
                        <Col md="12">
                          <FormGroup>
                            <label>Address</label>
                            <Input
                              defaultValue={this.state.address}
                              type="text"
                              onblur={(e) => this.change(e, "address")}
                            />
                          </FormGroup>
                        </Col>
                      </Row>
                      <Row>
                        <Col className="pr-1" md="4">
                          <FormGroup>
                            <label>Postal Code</label>
                            <Input 
                              placeholder={this.state.zipCode} 
                              type="number" 
                              onChange={(e) => this.change(e, "zipCode")}
                            />
                          </FormGroup>
                        </Col>
                        <Col className="px-1" md="4">
                          <FormGroup>
                            <label>City</label>
                            <Input
                              defaultValue={this.state.city}
                              type="text"
                              onChange={(e) => this.change(e, "city")}
                            />
                          </FormGroup>
                        </Col>
                        <Col className="pl-1" md="4">
                          <FormGroup>
                            <label>Country</label>
                            <Input
                              defaultValue={this.state.country}
                              type="text"
                              onChange={(e) => this.change(e, "country")}
                            />
                          </FormGroup>
                        </Col>
                      </Row>
                      <Row>
                        <Col md="6">
                          <FormGroup>
                          <Label>Role(s)</Label>
                            <Select
                              className="react-select primary"
                              classNamePrefix="react-select"
                              name="roleSelect"
                              //defaultInputValue={this.state.role}
                              isDisabled={this.state.disableIfOwnProfile}
                              value={this.state.roleSelect}
                              onChange={(value) => this.setState({ role: value.value, roleSelect: value })}
                              options={this.state.userRolesList}
                              placeholder="Select Role"
                            />
                          </FormGroup>
                        </Col>
                      </Row>
                      <Row>
                        <Col md="6">
                          <FormGroup>
                          <Label>Access Rights</Label>
                          <Select
                              className="react-select info"
                              classNamePrefix="react-select"
                              placeholder="Choose Rights"
                              name="multipleSelect"
                              closeMenuOnSelect={false}
                              isMulti
                              value={this.state.permissionsSelect}
                              onChange={(value) => {
                                this.setState({ permissionsSelect: value });
                                let permissions = [];
                                value.map(e => permissions.push(e.value))
                                this.setState({ permissions: permissions })
                              }
                                
                              }
                              options={[
                                {
                                  value: "",
                                  label: " Multiple Options",
                                  isDisabled: true,
                                },
                                { value: "media", label: "Media " },
                                { value: "documents", label: "Documents" },
                                { value: "organizingCommittee", label: "Organizing Committee" },
                              ]}
                            />
                          </FormGroup>
                        </Col>
                      </Row>
                    </Form>
                  </CardBody>
                  <CardFooter>
                    <hr />
                    <Row>
                      <Col md="10">
                      </Col>
                      <Col md="2">
                        <Button color="primary" onClick={this.updateClick}>
                          Update
                        </Button>
                      </Col>
                    </Row>
                  </CardFooter>
                </Card>
              </Col>
            </Row>
          </div>
        </>
      );
    }
  }
}
UserEdit.contextType = AuthContext;

export default UserEdit;
