const express = require("express");
const app = express();
const cors = require("cors");
const PORT = process.env.PORT || 3001;
require("dotenv").config();


// CORS Configuration - This is crucial for your deployment
const corsOptions = {
  origin: [
    "http://localhost:5173", // Your local frontend
    "https://eventment-assignment11.web.app", // Replace with your actual frontend Vercel URL
    // Add any other frontend URLs you might use
  ],
  credentials: true,
  optionsSuccessStatus: 200
};


app.use(cors(corsOptions));
app.use(express.json());
// CORS Configuration - This is crucial for your deployment



app.get("/", (req, res) => {
  res.send("Coffee server is ready to be used!");
});

app.listen(PORT, () => {
  console.log(`Coffee server is currently running on port number: ${PORT}`);
});

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@first-try-mongodb-atlas.3vtotij.mongodb.net/?retryWrites=true&w=majority&appName=First-Try-Mongodb-Atlas-Cluster1`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// copied from firebase console -> running project -> project settings -> service accounts -> firebase admin sdk
const admin = require("firebase-admin");

// decoding the stuffs that you encoded in keyConvert.js file
const decoded = Buffer.from(
  process.env.FIREBASE_SERVICE_KEY,
  "base64"
).toString("utf8");
const serviceAccount = JSON.parse(decoded);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

// writing middleware for verifying the token
const verifyFirebaseToken = async (req, res, next) => {
  const authHeader = req?.headers?.authorization;
  // console.log(authorization);

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).send({
      message: "Sorry man, you are trying to do an unauthorized access!",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log("decodeed token", decoded);
    req.decoded = decoded;
    next();
  } catch (error) {
    return res.status(401).send({
      message: "Sorry man, you are trying to do an unauthorized access!",
    });
  }
};

// writing middleware to reduce duplications of code
const verifyTokenEmail = (req, res, next) => {
  const requestEmail = req.query.email || req.body.email;
  if (requestEmail !== req.decoded.email) {
    return res.status(403).send({
      message: "forbidden acess. sorry from verifyTokenEmail function.",
    });
  }
  next();
};

// এসাইনমেন্ট-11 এর গ্রুপ গুলোর জন্য ব্র্যান্ড নিউ ডাটাবেস ও কালেকশন
const eventDatabase = client.db("eventAs11DB");
const eventCollection = eventDatabase.collection("eventAs11COL");
const joinedEventCollection = eventDatabase.collection("joinedEventAs11COL");

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();
    // adding a new event info in the database that has been created by the user
    app.post(
      "/events/post",
      verifyFirebaseToken,
      verifyTokenEmail,
      async (req, res) => {
        const newEvent = req.body;
        const result = await eventCollection.insertOne(newEvent);
        res.send(result);
      }
    );

    // get method to get all the events data
    app.get("/events/get", async (req, res) => {
      try {
        const { type, search } = req.query;
        let query = {};
        // 1 Sort by eventType
        if (type) {
          query.eventType = type;
        }
        // 2 Add filter to show only future events
        const currentDate = new Date();
        query.startDate = { $gte: currentDate.toISOString() };
        // 3 Search by eventTitle
        if (search) {
          query.eventTitle = { $regex: search, $options: "i" };
        }

        const cursor = eventCollection.find(query).sort({ startDate: 1 });
        const result = await cursor.toArray();
        res.send(result);
      } catch (error) {
        console.error("Error fetching events:", error);
        res.status(500).send({ error: "Failed to fetch events" });
      }
    });

    // get method to get the events created by one specific user
    app.get(
      `/events`,
      verifyFirebaseToken,
      verifyTokenEmail,
      async (req, res) => {
        const myEmail = req.query.email;
        const query = { email: myEmail };
        const cursor = eventCollection.find(query);
        const result = await cursor.toArray();
        res.send(result);
      }
    );

    // get method to get a single event's data through id
    app.get("/events/get/:eventID", async (req, res) => {
      const eventID = req.params.eventID;
      const query = { _id: new ObjectId(eventID) };
      const result = await eventCollection.findOne(query);
      res.send(result);
    });

    // finding a "myEvent" with id and deleting it from the collection
    app.delete(
      "/myEvent/delete/:myEventID",
      verifyFirebaseToken,
      verifyTokenEmail,
      async (req, res) => {
        const myEventID = req.params.myEventID;
        const query = { _id: new ObjectId(myEventID) };
        const result = await eventCollection.deleteOne(query);
        res.send(result);
      }
    );

    // Get featured events
    app.get("/events/featured", async (req, res) => {
      const query = { isFeatured: "true" };
      const result = await eventCollection.find(query).toArray();
      res.send(result);
    });

    // Finding a specific "myEvent" and Updating that specific "myEvent" data
    app.put(
      "/myEvent/put/:myEventID",
      verifyFirebaseToken,
      verifyTokenEmail,
      async (req, res) => {
        const myEventID = req.params.myEventID;
        const query = { _id: new ObjectId(myEventID) };
        const options = { upsert: true };
        const updateMyEventInfo = req.body;
        const updatedDOC = {
          $set: updateMyEventInfo,
        };

        const result = await eventCollection.updateOne(
          query,
          updatedDOC,
          options
        );
        res.send(result);
      }
    );

    // inserting the join event data
    app.post(
      `/joinedEvent`,
      verifyFirebaseToken,
      verifyTokenEmail,
      async (req, res) => {
        const newJoinedEvent = req.body;
        const { email, groupID } = newJoinedEvent;
        const doesEventExist = await joinedEventCollection.findOne({
          email,
          groupID,
        });
        if (doesEventExist) {
          return res
            .status(409)
            .json({ message: "Already joined this event." });
        }
        const result = await joinedEventCollection.insertOne(newJoinedEvent);
        res.send(result);
      }
    );

    // getting the joined events of a specific user
    app.get(
      `/joinedEvent`,
      verifyFirebaseToken,
      verifyTokenEmail,
      async (req, res) => {
        const email = req.query.email;
        const query = { email };
        const joinedEventsSortedByDate = await joinedEventCollection
          .find(query)
          .sort({ startDate: 1 })
          .toArray();

        res.send(joinedEventsSortedByDate);
      }
    );
    // Send a ping to confirm a successful connection
    // await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);
