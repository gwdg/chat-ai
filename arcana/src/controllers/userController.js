const userService = require("../services/userService");

exports.getUser = async (req, res) => {
  const userEmail = req.user?.email || req.header("email");

  if (!userEmail) {
    return res.status(400).json({ message: "Email header is missing" });
  }

  try {
    const user = await userService.fetchUserInfo(userEmail);
    return res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createUser = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const newUser = await userService.createUser(email);
    res.status(201).json(newUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  const userEmail = req.params.email;
  const updateData = req.body;

  try {
    const updatedUser = await userService.updateUser(userEmail, updateData);
    res.status(200).json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  const userEmail = req.params.email;

  try {
    await userService.deleteUser(userEmail);
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
