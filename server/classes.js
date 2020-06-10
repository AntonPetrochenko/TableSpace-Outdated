const { db, groupList } = require("./main");
class Group {
	id;
	displayName;
	#canVideo;
	#canAudio;
	#canChat;
	#canTable;
	constructor(id, displayName, canVideo, canAudio, canChat, canTable) {
		this.id = id;
		this.displayName = displayName;
		this.#canVideo = canVideo;
		this.#canAudio = canAudio;
		this.#canChat = canChat;
		this.#canTable = canTable;
	}
	get() {
		return {
			canVideo: this.#canVideo,
			canAudio: this.#canAudio,
			canChat: this.#canChat,
			canTable: this.#canTable
		};
	}
	fetch() {
		db.get('SELECT * FROM groups WHERE id = $id', { $id: this.id }, (err, row) => {
			this.displayName = row.displayName;
			this.#canVideo = row.canVideo;
			this.#canAudio = row.canAudio;
			this.#canChat = row.canChat;
			this.#canTable = row.canTable;
		});
	}
}
exports.Group = Group;
class User {
	id;
	displayName;
	adminPermissions;
	connectPermissions;
	color;
	profilePicturePath;
	#group;
	#groupId;
	constructor(id, displayName, adminPermissions, connectPermissions, color, profilePicturePath, group, groupId) {
		this.id = id;
		this.displayName = displayName;
		this.adminPermissions = adminPermissions;
		this.connectPermissions = connectPermissions;
		this.color = color;
		this.profilePicturePath = profilePicturePath;
		this.#group = group;
		this.#groupId = groupId;
	}
	getPermissions() {
		if (this.#group) {
			return this.#group.get();
		}
		else {
			return {
				canVideo: false,
				canAudio: false,
				canChat: false,
				canTable: false,
			};
		}
	}
	setGroup(groupId) {
		this.#group = groupList[groupId];
		this.#groupId = groupId;
	}
	getGroupId() {
		return this.#groupId;
	}
}
exports.User = User;
class Widget {
	x = 800;
	y = 450;
	displayWidth;
	displayHeight;
	currentScale;
	type;
	constructor(type) {
		this.type = type;
		this.currentScale = 1;
	}
}
class PictureBox extends Widget {
	filename
	constructor(filename) {
		super("picture");
		this.filename = filename;
	}
}
exports.PictureBox = PictureBox;
class PdfBox extends Widget {
	currentPage = 1;
	constructor(filename) {
		super("pdf");
		this.filename = filename;
	}
}
exports.PdfBox = PdfBox;
class Drawing {
	constructor(points, fill, stroke, relatedNetworkId, relatedPage, eraseId) {
		this.points = points;
		this.fill = fill;
		this.stroke = stroke;
		this.relatedNetworkId = relatedNetworkId;
		this.relatedPage = relatedPage;
		this.eraseId = eraseId;
	}
}
exports.Drawing = Drawing;
