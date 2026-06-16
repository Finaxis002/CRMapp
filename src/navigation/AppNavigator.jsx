import React from "react";
import AuthNavigator from "./AuthNavigator";
import MainNavigator from "./MainNavigator";

const AppNavigator = ({ isAuthenticated }) => {
  return isAuthenticated ? <MainNavigator /> : <AuthNavigator />;
};

export default AppNavigator;
