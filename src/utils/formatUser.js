const formatUser = (user) => {
  if (!user) return null;

  const userObj = user.toObject();

  if (userObj.avatar && userObj.avatar.data) {
    userObj.avatar = `data:${
      userObj.avatar.contentType
    };base64,${userObj.avatar.data.toString('base64')}`;
  } else {
    userObj.avatar = null; // or default placeholder
  }

  delete userObj.password; // never send password
  //   delete userObj.tokens;   // optional, hide tokens array
  return userObj;
};

module.exports = formatUser;
