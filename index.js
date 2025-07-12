const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const app = express();
require("dotenv").config();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rcb0n.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
    // post related apis
    const jobsCollection = client.db("volunteerConnect").collection("jobs");

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
    app.get("/jobs/:email", async (req, res) => {
      const email = req.params.email;
      const query = { "host.email": email };
      const result = await jobsCollection.find(query).toArray();
      res.send(result);
    });

    // save a job data in db
    app.post("/add-job", async (req, res) => {
      const postData = req.body;
      const result = await jobsCollection.insertOne(postData);
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
