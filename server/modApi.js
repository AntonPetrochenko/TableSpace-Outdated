var bcrypt = require('bcrypt');
const { db } = require("./main");
const modApi = (req, res, next) => {
	if (req.params.requesttype == "adduser") {
		console.log("Someone's adding a user");
		bcrypt.hash(req.body.password, 10, function (err, hash) {
			db.run('INSERT INTO users (displayName,login,passwordHash,permissionLevel,connectPermissions,color,userGroup) VALUES ($displayName,$login,$passwordHash,$permissionLevel,$connectPermissions,$color,$userGroup)', {
				$displayName: req.body.displayName,
				$login: req.body.login,
				$passwordHash: hash,
				$permissionLevel: 0,
				$connectPermissions: 1,
				$color: "#0000FF",
				$userGroup: req.body.group
			});
			res.json({
				status: "Success"
			});
		});
	}
	if (req.params.requesttype == "controluser") {
		console.log('We be controllin');
		console.log(JSON.stringify(req.body));
		db.run('UPDATE users SET userGroup = $group, connectPermissions = $connect WHERE id = $id', {
			$group: Number(req.body.group),
			$connect: (req.body.actiontype == "ban" ? 0 : 1),
			$id: Number(req.body.uid)
		}, (err) => {
			if (err) {
				console.error(err);
			}
		});
		res.json({
			status: 'success'
		});
	}
};
exports.modApi = modApi;
