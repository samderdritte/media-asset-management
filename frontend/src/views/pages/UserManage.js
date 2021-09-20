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
// react component used to create sweet alerts
import ReactBSAlert from "react-bootstrap-sweetalert";
// react plugin for creating notifications over the dashboard
import NotificationAlert from "react-notification-alert";
import axios from 'axios';
import AuthContext from '../../Context/AuthContext';

// reactstrap components
import {
  Button,
  Card,
  CardHeader,
  CardBody,
  CardTitle,
  Table,
  Row,
  Col,
  UncontrolledTooltip,
} from "reactstrap";

class UserManage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      alert: null,
      userRolesListFetched: false,
      userRolesList: [],
      userPermissionsListFetched: false,
      userPermissionsList: [],
      users: [],
      usersFetched: false,
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

    if(this.context.user && !this.state.usersFetched) {
      this.fetchUserList();
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

  fetchUserRolesList = async () => {
    console.log("Fetching user roles from database.")
    try {
      // Fetch the user roles from the DB
      const { data } = await axios.get(`/api/secure/users/roles/list`);
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
      const { data } = await axios.get(`/api/secure/users/permissions/list`);
      const permissions = data.map((perm) => {return {value: perm.name, label: perm.label} })
      this.setState({
        userPermissionsList: permissions,
        userPermissionsListFetched: true
      });

    } catch(err) {
      console.log(err)
    }
  }

  fetchUserList = async () => {
    console.log("Fetching List of Users from database.")

    try {
      // Fetch the users from the database
      const { data } = await axios.get(`/api/secure/users/list`);
      this.setState({
        usersFetched: true,
        users: data,
      })

    } catch(err) {
      console.log(err)
    }
  }

  renderPermissions = (permissions) => {
    if (permissions == null || permissions.length < 1) {
      return null;
    }
    let permissionLabels = []
    const userPermissionsList = this.state.userPermissionsList;
    
    if (this.state.userPermissionsListFetched) {
      permissions.forEach(permission => {
        let obj = userPermissionsList.find(p => p.value === permission)
        permissionLabels.push(<span key={obj.label}>{obj.label}<br /></span>)
      });
    }
    return permissionLabels
  }

  renderTableRow() {
    

    if (!this.state.usersFetched || !this.state.userPermissionsListFetched || !this.state.userRolesListFetched) {
      return null
    }
    let rows = this.state.users.map((user, i) => {
      const permissionLabels = this.renderPermissions(user.permissions);      
      const userRole = this.state.userRolesList.find(r => r.value === user.role)
      return (
        <tr key={user.email}>
          <td className="text-center">{i+1}</td>
          <td>{user.name} {user.surname}</td>
          <td>{user.email}</td>
          <td>{userRole !== undefined ? userRole.label : "-"}</td>
          <td className="text-left">{permissionLabels !== null ? permissionLabels : "–"}</td>
          <td className="text-center">{user.fileCount !== undefined ? user.fileCount : "-"}</td>
          <td className="text-right">
            <Button
              className="btn-icon"
              color="info"
              id="tooltip269174504"
              size="sm"
              type="button"
              onClick={() => this.resetPassword(user)}
            >
              <i className="fa fa-refresh" />
            </Button>{" "}
            <UncontrolledTooltip
              delay={0}
              target="tooltip269174504"
            >
              Reset Password
            </UncontrolledTooltip>
            <Button
              className="btn-icon"
              color="success"
              id="tooltip366246651"
              size="sm"
              type="button"
              onClick={() => this.props.history.push(`/admin/user-edit/${user._id}`)}
            >
              <i className="fa fa-edit" />
            </Button>{" "}
            <UncontrolledTooltip
              delay={0}
              target="tooltip366246651"
            >
              Edit
            </UncontrolledTooltip>
            <Button
              className="btn-icon"
              color="danger"
              id="tooltip476609793"
              size="sm"
              type="button"
              onClick={() => this.deleteUser(user)}
            >
              <i className="fa fa-times" />
            </Button>{" "}
            <UncontrolledTooltip
              delay={0}
              target="tooltip476609793"
            >
              Delete
            </UncontrolledTooltip>
          </td>
        </tr>
      )
    })
    return rows;
  }

  resetPassword = async (user) => {
    const email = user.email;
    const postData = { email};  
    try {
      // Send password reset link to user
      await axios.post(`/api/users/password/reset`, postData);
      this.notify("br", "success", `Password reset email sent to ${email}.`);
    } catch(err) {
      console.log(err)
    }
  }

  deleteUser = (user) => {
    this.setState({
      alert: (
        <ReactBSAlert
          warning
          style={{ display: "block", marginTop: "-100px" }}
          title="Are you sure?"
          onConfirm={() => this.successDelete(user)}
          onCancel={() => this.hideAlert()}
          confirmBtnBsStyle="info"
          cancelBtnBsStyle="danger"
          confirmBtnText="Yes, delete!"
          cancelBtnText="Cancel"
          showCancel
          btnSize=""
        >
          Do you want to delete user «{user.name} {user.surname}»? <br/>
          This action cannot be undone!
        </ReactBSAlert>
      ),
    });
  };

  successDelete = async (user) => {
    const email = user.email;
    const postData = { email};  
    try {
      // Send password reset link to user
      await axios.post(`/api/secure/users/delete`, postData);
      this.setState({
        alert: (
          <ReactBSAlert
            success
            style={{ display: "block", marginTop: "-100px" }}
            title="Deleted!"
            onConfirm={() => this.hideAlert()}
            onCancel={() => this.hideAlert()}
            confirmBtnBsStyle="info"
            btnSize=""
          >
            User «{user.name} {user.surname}» has been deleted.
          </ReactBSAlert>
        ),
      });
    } catch(err) {
      console.log(err)
      this.setState({
        alert: (
          <ReactBSAlert
            error
            style={{ display: "block", marginTop: "-100px" }}
            title="Something went wrong!"
            onConfirm={() => this.hideAlert()}
            onCancel={() => this.hideAlert()}
            confirmBtnBsStyle="info"
            btnSize=""
          >
            Could not delete user «{user.name} {user.surname}».
          </ReactBSAlert>
        ),
      });
    }
  };

  hideAlert = () => {
    this.setState({
      alert: null,
    });
    this.fetchUserList();
  };

  createUserClick = () => {
    this.props.history.push("/admin/user-create");
  }

  render() {
    if (!this.context.isAuthenticated) {
      return (
        <div className="content">
          You need to be logged in to access this page.
        </div>
      )
    }

    if (this.context.isAuthenticated && !this.context.user.is_admin) {
      return (
        <div className="content">
          You need to be an administrator to access this page.
        </div>
      )
    }
    return (
      <>
        <div className="content">
          <NotificationAlert ref="notificationAlert" className="alert-with-icon" />
          {this.state.alert}
          <Row>
            <Col md="12">
              <Card>
                <CardHeader>
                  <CardTitle tag="h4">Users</CardTitle>
                  
                </CardHeader>
                <CardBody>
                  <Table responsive>
                    <thead className="text-primary">
                      <tr>
                        <th className="text-center">#</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th className="text-left">Permissions</th>
                        <th className="text-center">Files</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {this.renderTableRow()}
                    </tbody>
                  </Table>
                </CardBody>
              </Card>
            </Col>
          </Row>
          <Row>
            <Col md="2">
                  <Button color="success" onClick={this.createUserClick}>
                    <span className="btn-label">
                      <i className="nc-icon nc-simple-add" />
                    </span>
                    New User
                </Button>
              
            </Col>
            </Row>
        </div>
      </>
    );
  }
}
UserManage.contextType = AuthContext;

export default UserManage;
