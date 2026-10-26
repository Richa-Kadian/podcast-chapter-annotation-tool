// Used as a Mongoose toJSON transform. Renames Mongo's "_id" to "id" and
// hides "__v", so the frontend can keep using `session.id` exactly like it
// did when sessions lived in LocalStorage.
function cleanJson(doc, ret) {
  ret.id = ret._id.toString();
  delete ret._id;
  delete ret.__v;
  return ret;
}

module.exports = cleanJson;
