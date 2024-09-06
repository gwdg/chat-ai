const axios = require("axios");

exports.fetchUserInfo = async (email) => {
  try {
    const response = await axios.get(
      `${process.env.API_BASE_URL}/users/${email}`
    );
    return response.data;
  } catch (error) {
    if (error.response && error.response.status === 404) {
      const newUser = await this.createUser(email);
      return newUser;
    } else {
      throw new Error("Failed to fetch user info");
    }
  }
};

exports.createUser = async (email) => {
  try {
    const response = await axios.post(`${process.env.API_BASE_URL}/users`, {
      email,
    });
    return response.data;
  } catch (error) {
    throw new Error("Failed to create user");
  }
};

exports.deleteUser = async (email) => {
  try {
    await axios.delete(`${process.env.API_BASE_URL}/users/${email}`);
  } catch (error) {
    throw new Error("Failed to delete user");
  }
};
