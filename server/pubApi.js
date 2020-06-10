const { groupList, db } = require("./main");
const pubApi = (req, res, next) => {
	if (req.params.requesttype == "grouplist") {
		let resObject = [];
		groupList.forEach(group => {
			if (group) {
				resObject.push({
					id: group.id,
					displayName: group.displayName
				});
			}
		});
		res.json({
			status: "success",
			data: resObject
		});
	}
	if (req.params.requesttype == "userlist") {
		db.all("SELECT users.id, users.permissionLevel, users.displayName, users.userGroup, groups.displayName as 'groupName' FROM users, groups WHERE users.userGroup = groups.id", (err, rows) => {
			let resObject = [];
			rows.forEach(row => {
				resObject.push({
					id: row.id,
					displayName: row.displayName,
					group: row.groupName,
					groupId: row.userGroup,
					permissionLevel: row.permissionLevel
				});
			});
			res.json({
				status: "success",
				data: resObject
			});
			res.end();
		});
	}
};
exports.pubApi = pubApi;
