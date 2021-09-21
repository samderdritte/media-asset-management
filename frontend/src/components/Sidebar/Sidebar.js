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
import { NavLink } from "react-router-dom";
import { Nav, Collapse } from "reactstrap";
// javascript plugin used to create scrollbars on windows
import PerfectScrollbar from "perfect-scrollbar";

import logo from "assets/img/react-logo.png";

import axios from 'axios';
import AuthContext from '../../Context/AuthContext';
var ps;

const apiUrl = process.env.REACT_APP_API_URL



class Sidebar extends React.Component {
  constructor(props) {
    super(props);
    this.getCsrfToken();
    this.state = this.getCollapseStates(props.routes);
    
    this.state.user = null;
    let isLoggedIn = localStorage.getItem("isLoggedIn");
    
    if (isLoggedIn === "true") {
      console.log("User was already logged in. Fetching his data.")
      this.getCurrentUser();
    }
  }

  // this checks whether a valid jwt token is set. 
  // if it is set, then the current user's info is fetched from the db and stored in state & context.
  getCurrentUser = async () => {   
    try {
      
      const { data } = await axios.get(`${apiUrl}/api/secure/users/current`);
      console.log(data);
      this.setState({user: data});
      this.context.logIn(data)
      console.log(this.state);
    } catch(err) {
        console.log(err)
        localStorage.setItem("isLoggedIn", "false");
      }
  }

  getCsrfToken = async () => {
    const { data } = await axios.get(`${apiUrl}/api/csrf-token`);
    //console.log(data.csrfToken);
    axios.defaults.headers.post['X-CSRF-Token'] = data.csrfToken;
    axios.defaults.headers.get['X-CSRF-Token'] = data.csrfToken;
    //console.log(axios.defaults.headers);
  };

  // this creates the intial state of this component based on the collapse routes
  // that it gets through this.props.routes
  getCollapseStates = (routes) => {
    let initialState = {};
    routes.map((prop, key) => {
      if (prop.collapse) {
        initialState = {
          [prop.state]: this.getCollapseInitialState(prop.views),
          ...this.getCollapseStates(prop.views),
          ...initialState,
        };
      }
      return null;
    });
    return initialState;
  };
  // this verifies if any of the collapses should be default opened on a rerender of this component
  // for example, on the refresh of the page,
  // while on the src/views/forms/RegularForms.js - route /admin/regular-forms
  getCollapseInitialState(routes) {
    for (let i = 0; i < routes.length; i++) {
      if (routes[i].collapse && this.getCollapseInitialState(routes[i].views)) {
        return true;
      } else if (window.location.pathname.indexOf(routes[i].path) !== -1) {
        return true;
      }
    }
    return false;
  }
  // this function creates the links and collapses that appear in the sidebar (left menu)
  createLinks = (routes) => {
    return routes.map((prop, key) => {
      if (prop.invisible) {
        return null;
      }
      if (prop.redirect) {
        return null;
      }
      if (prop.collapse) {
        var st = {};
        st[prop["state"]] = !this.state[prop.state];
        return (
          <li
            className={this.getCollapseInitialState(prop.views) ? "active" : ""}
            key={key}
          >
            <a
              href="#pablo"
              data-toggle="collapse"
              aria-expanded={this.state[prop.state]}
              onClick={(e) => {
                e.preventDefault();
                this.setState(st);
              }}
            >
              {prop.icon !== undefined ? (
                <>
                  <i className={prop.icon} />
                  <p>
                    {prop.name}
                    <b className="caret" />
                  </p>
                </>
              ) : (
                <>
                  <span className="sidebar-mini-icon">{prop.mini}</span>
                  <span className="sidebar-normal">
                    {prop.name}
                    <b className="caret" />
                  </span>
                </>
              )}
            </a>
            <Collapse isOpen={this.state[prop.state]}>
              <ul className="nav">{this.createLinks(prop.views)}</ul>
            </Collapse>
          </li>
        );
      }
      return (
        <li className={this.activeRoute(prop.layout + prop.path)} key={key}>
          <NavLink to={prop.layout + prop.path} activeClassName="">
            {prop.icon !== undefined ? (
              <>
                <i className={prop.icon} />
                <p>{prop.name}</p>
              </>
            ) : (
              <>
                <span className="sidebar-mini-icon">{prop.mini}</span>
                <span className="sidebar-normal">{prop.name}</span>
              </>
            )}
          </NavLink>
        </li>
      );
    });
  };
  // verifies if routeName is the one active (in browser input)
  activeRoute = (routeName) => {
    return this.props.location.pathname.indexOf(routeName) > -1 ? "active" : "";
  };
  componentDidMount() {
    // if you are using a Windows Machine, the scrollbars will have a Mac look
    if (navigator.platform.indexOf("Win") > -1) {
      ps = new PerfectScrollbar(this.refs.sidebar, {
        suppressScrollX: true,
        suppressScrollY: false,
      });
    }
  }
  componentWillUnmount() {
    // we need to destroy the false scrollbar when we navigate
    // to a page that doesn't have this component rendered
    if (navigator.platform.indexOf("Win") > -1) {
      ps.destroy();
    }
  }
  render() {
    return (
      <div
        className="sidebar"
        data-color={this.props.bgColor}
        data-active-color={this.props.activeColor}
      >
        <div className="logo">
          <a
            href="/"
            className="simple-text logo-mini"
          >
            <div className="logo-img">
              <img src={logo} alt="react-logo" />
            </div>
          </a>
          <a
            href="/"
            className="simple-text logo-normal"
          >
            Media hub
          </a>
        </div>

        <div className="sidebar-wrapper" ref="sidebar">
          { this.context.isAuthenticated && 
            <div className="user">  
              <div className="photo">
                <p className="avatar-icon">
                <i className="nc-icon nc-circle-10 avatar-icon"></i></p>
              </div>
              <div className="info">
                <a
                  href="#pablo"
                  data-toggle="collapse"
                  aria-expanded={this.state.openAvatar}
                  onClick={() =>
                    this.setState({ openAvatar: !this.state.openAvatar })
                  }
                >
                  <span>
                    {this.context.user.name !== '' || this.context.user.surname !== '' ? this.context.user.name : 'Account'} {this.context.user.surname}
                    <b className="caret" />
                  </span>
                </a>
                <Collapse isOpen={this.state.openAvatar}>
                  <ul className="nav">
                    <li>
                      <NavLink to="/admin/user-profile" activeClassName="">
                        <span className="sidebar-mini-icon">MP</span>
                        <span className="sidebar-normal">My Profile</span>
                      </NavLink>
                    </li>
                    
                    {this.context.user.is_admin &&
                    <li>
                      <NavLink to="/admin/user-manage" activeClassName="">
                        <span className="sidebar-mini-icon">MU</span>
                        <span className="sidebar-normal">Manage Users</span>
                      </NavLink>
                    </li>
                    }
                    <li>
                      <NavLink to="/admin/dashboard" onClick={() => {this.context.logOut()}} activeClassName="">
                        <span className="sidebar-mini-icon">X</span>
                        <span className="sidebar-normal">Logout</span>
                      </NavLink>
                    </li>
                  </ul>
                </Collapse>
              </div>
            </div>
          }
          { !this.context.isAuthenticated && 
           <div>
            <div className="user">  
            <div className="photo">
              <p className="avatar-icon">
              <i className="nc-icon nc-circle-10 avatar-icon"></i></p>
            </div>
            <div className="info">
              <a
                href="/admin/user-login"
                data-toggle="collapse"
                aria-expanded={this.state.openAvatar}
              >
                <span>
                  User Login
                </span>
              </a>
            </div>
            </div>
            </div>

          }
          
          <Nav>{this.createLinks(this.props.routes)}</Nav>
        </div>
      </div>
    );
  }
}

Sidebar.contextType = AuthContext;

export default Sidebar;
