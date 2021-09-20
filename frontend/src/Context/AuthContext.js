import React, { Component } from 'react';
import axios from 'axios';

const AuthContext = React.createContext();

export class AuthProvider extends Component {
    state = {
        user : null,
        token: undefined,
        isAuthenticated : false
    }

    logIn = (user) => {
        this.setState({user : user, isAuthenticated : true});
        // set a flag in local storage
        localStorage.setItem("isLoggedIn", "true");
    } 

    logOut = () => {
        this.setState({user : null, isAuthenticated : false});
        // delete flag in local storage
        localStorage.setItem("isLoggedIn", "false");
    } 

    refreshUserData = async () => {
        const apiUrl = process.env.REACT_APP_API_URL

        try {
            const { data } = await axios.get(`${apiUrl}/api/secure/users/current`);
            this.setState({user: data});
          
        } catch(err) {
            console.log(err)
            }
    }
    
    render() {
        const { user, isAuthenticated } = this.state;
        const { logIn, logOut, refreshUserData } = this;
        return(
            <AuthContext.Provider value={{
                user,
                isAuthenticated,
                logIn,
                logOut,
                refreshUserData
            }}
            >
                {this.props.children}
            </AuthContext.Provider>
        )
    }
}

export default AuthContext;