const axios = require("axios");

exports.getArcanaInfo = async (req, res) => {
  const userEmail = req.header("email"); // Extract the email from the request header

  if (!userEmail) {
    return res.status(400).json({ message: "Email header is missing" });
  }

  try {
    // Step 1: Make a GET request to check if the user exists
    let response = await axios.get(
      `https://llm.hpc.gwdg.de/api/users/${userEmail}`
    );

    // Step 2: If the user exists, return the JSON response to the frontend
    if (response.status === 200) {
      return res.status(200).json(response.data);
    }
  } catch (error) {
    // Step 3: If user doesn't exist (404), create the user by sending a POST request
    if (error.response && error.response.status === 404) {
      try {
        // Replace this with the correct body if needed
        await axios.post(`https://llm.hpc.gwdg.de/api/users`, {
          email: userEmail,
        });

        // Step 4: After creating the user, send the GET request again
        const newUserResponse = await axios.get(
          `https://llm.hpc.gwdg.de/api/users/${userEmail}`
        );

        // Step 5: Return the JSON response to the frontend
        return res.status(200).json(newUserResponse.data);
      } catch (postError) {
        return res
          .status(500)
          .json({ message: "Error creating user", error: postError.message });
      }
    } else {
      return res
        .status(500)
        .json({ message: "An error occurred", error: error.message });
    }
  }
};
