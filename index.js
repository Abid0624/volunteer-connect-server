const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
const e = require("express");
require("dotenv").config();
const port = process.env.PORT || 3000;

const corsOptions = {
  origin: [
    "http://localhost:5173",
    "https://volunteer-connect-24d71.web.app",
    "https://volunteer-connect-24d71.firebaseapp.com",
  ],
  credentials: true,
  optionalSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rcb0n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// verify token
const verifyToken = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return res.status(401).send({ message: "Unauthorized Access!" });
  jwt.verify(token, process.env.SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "Unauthorized Access!" });
    }
    req.user = decoded;
  });
  next();
};

async function run() {
  try {
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!"
    // );
    // post related apis
    const jobsCollection = client.db("volunteerConnect").collection("jobs");
    const applicantsCollection = client
      .db("volunteerConnect")
      .collection("applicants");

    // generate jwt token
    app.post("/jwt", async (req, res) => {
      const email = req.body;
      // create token
      const token = jwt.sign(email, process.env.SECRET_KEY, {
        expiresIn: "365d",
      });

      res
        .cookie("token", token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // clear cookie from browser
    app.get("/logout", async (req, res) => {
      res
        .clearCookie("token", {
          maxAge: 0,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({ success: true });
    });

    // get all jobs
    app.get("/jobs", async (req, res) => {
      const result = await jobsCollection.find().toArray();
      res.send(result);
    });

    // get only 6 cards based on the upcoming deadline(asc order)
    app.get("/asc-jobs", async (req, res) => {
      const result = await jobsCollection
        .find({})
        .sort({ deadline: 1 })
        .limit(6)
        .toArray();
      res.send(result);
    });

    // get all posts by a specific user
    app.get("/jobs/:email", verifyToken, async (req, res) => {
      const decodedEmail = req.user.email;
      const email = req.params.email;

      if (decodedEmail !== email)
        return res.status(401).send({ message: "Unauthorized Access!" });

      const query = { "host.email": email };
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    // delete a job from db
    app.delete("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.deleteOne(query);
      res.send(result);
    });

    // get a single job data by id from db
    app.get("/job/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await jobsCollection.findOne(query);
      res.send(result);
    });

    // save a job data in db
    app.post("/add-job", verifyToken, async (req, res) => {
      const postData = req.body;
      const result = await jobsCollection.insertOne(postData);
      res.send(result);
    });

    // update a job data in db
    app.put("/update-job/:id", verifyToken, async (req, res) => {
      const id = req.params.id;
      const postData = req.body;
      const updated = {
        $set: postData,
      };
      const query = { _id: new ObjectId(id) };
      const options = { upsert: true };
      const result = await jobsCollection.updateOne(query, updated, options);
      res.send(result);
    });

    // save a applicant data in db
    app.post("/add-application", async (req, res) => {
      // save data in applicant collection
      const postData = req.body;

      // check a user is applied this post already
      const query = {
        volunteerEmail: postData.volunteerEmail,
        postId: postData.postId,
      };
      const alreadyExist = await applicantsCollection.findOne(query);
      if (alreadyExist)
        return res.status(400).send("You have already applied for this post!");

      const result = await applicantsCollection.insertOne(postData);

      // decrease no. of volunteer in job collection
      const filter = { _id: new ObjectId(postData.postId) };
      const update = {
        $inc: { noOfVolunteer: -1 },
      };
      const updateNoOfVolunteerNeed = await jobsCollection.updateOne(
        filter,
        update
      );

      res.send(result);
    });

    // get all application for a specific user
    app.get("/applications/:email", verifyToken, async (req, res) => {
      const decodedEmail = req.user.email;
      const email = req.params.email;

      if (decodedEmail !== email)
        return res.status(401).send({ message: "Unauthorized Access!" });

      const query = { volunteerEmail: email };
      const result = await applicantsCollection.find(query).toArray();
      res.send(result);
    });

    // delete a job from application db
    app.delete("/application/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await applicantsCollection.deleteOne(query);
      res.send(result);
    });

    // get all jobs
    app.get("/all-jobs", async (req, res) => {
      const search = req.query.search;
      let query = {
        title: {
          $regex: search,
          $options: "i",
        },
      };
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Volunteer is connecting....");
});

app.listen(port, () => {
  console.log(`volunteer is waiting at: ${port}`);
});
