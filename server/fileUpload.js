const { db } = require("./main");

const asyncHandler = fn => (req, res, next) =>
  Promise
    .resolve(fn(req, res, next))
    .catch(next);
function fileUpload() {
	return asyncHandler((req, res, next) => {
		const file = req.file;
		if (!file) {
			const error = new Error('Please upload a file');
			error.httpStatusCode = 400;
			return next(error);
		}
		res.json({
			status: "success"
		});
		db.run('INSERT INTO files (path, mimetype) VALUES ($path, $type)', {
			$path: '/uploads/' + file.filename,
			$type: file.mimetype
		}, (err) => {
			console.error(err);
		});
	});
}
exports.fileUpload = fileUpload;
