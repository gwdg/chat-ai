module.exports = (req, res, next) => {
  const userEmail = req.header("email");
  if (!userEmail) {
    return res.status(400).json({ message: "Email header is missing" });
  }
  req.user = { email: userEmail };
  next();
};
