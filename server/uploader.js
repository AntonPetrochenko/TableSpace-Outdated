class Uploader {

    constructor() {
        const storageOptions = multer.diskStorage({
            destination: function(req, file, cb) {
                cb(null, __dirname + '/uploads/')
            },
            filename: function(req, file, cb) {
                crypto.pseudoRandomBytes(16, function(err, raw) {
                    cb(null, raw.toString('hex') + Date.now() + '.' + file.originalname);
                });
            }
        });

        this.upload = multer({ storage: storageOptions });
    }

    async startUpload(req, res) {
        let filename;

        try {
            const upload = util.promisify(this.upload.any());

            await upload(req, res);

            filename = req.files[0].filename;
        } catch (e) {
            //Handle your exception here
        }

        return res.json({fileUploaded: filename});
    }
}