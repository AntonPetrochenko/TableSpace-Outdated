var bcrypt = require('bcrypt');
var hat = require('hat');
const { db } = require("./main");
const guestApi = (req, res, next) => {
	if (req.params.requesttype == "login") {
		console.log("Someone's logging in...");
		db.get('SELECT id, login, passwordHash FROM users WHERE login = $login', {
			$login: req.body.login
		}, (err, row) => {
			if (row) {
				bcrypt.compare(req.body.password, row.passwordHash, function (err, result) {
					if (result) {
						token = hat();
						res.cookie('token', token);
						db.run('UPDATE users SET authToken = $token WHERE id = $id', {
							$token: token,
							$id: row.id
						});
						res.json({
							status: "success"
						});
						console.log('Given an access token to ' + req.body.login);
					}
					else {
						res.json({
							status: "failure",
							reason: "Incorrect login or password!"
						});
						console.log('Incorrect login or password!');
					}
				});
			}
			else {
                res.json({
                    status: "failure",
                    reason: "Incorrect login or password!"
                });
				console.log('No such user!');
			}
		});
	}
};
exports.guestApi = guestApi;
