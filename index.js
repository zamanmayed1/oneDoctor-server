const express = require('express');
const cors = require('cors');
require('dotenv').config()
const jwt = require('jsonwebtoken');
const port = process.env.PORT || 5000;
const app = express()
// middlewar
app.use(cors())
app.use(express.json())


const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vddfm.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

function verifyJwt(req, res, next) {
    const authheader = req.headers.authorization
    if (!authheader) {
        return res.status(401).send({ message: 'Unauthorize Access' })
    }
    const token = authheader.split(' ')[1]
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
        if (err) {
            return res.status(403).send({ message: 'Forbidden Access' })
        }
        req.decoded = decoded
        next()
    });

}

async function run() {
    try {
        await client.connect();
        const Servicescollection = client.db("one_doctor").collection("services");
        const Bookingcollection = client.db("one_doctor").collection("booking");
        const Usercollection = client.db("one_doctor").collection("user");

        // Load Services
        app.get('/services', async (req, res) => {
            const query = {};
            const cursor = Servicescollection.find(query);
            const result = await cursor.toArray()
            res.send(result)

        })

        // Load Users
        app.get('/allusers', verifyJwt, async (req, res) => {
            const result = await Usercollection.find().toArray()
            res.send(result)

        })

        // Admin ki na
        app.get('/admin/:email', async (req, res) => {
            const email = req.params.email
            const user = await Usercollection.findOne({ email: email })
            const isadmin = user?.role === 'admin'
            res.send({ admin: isadmin })

        })

        // Make Admin Api

        app.put('/user/admin/:email', verifyJwt, async (req, res) => {
            const email = req.params.email
            const requester = req.decoded.email
            const requesterAccount = await Usercollection.findOne({ email: requester })
            if (requesterAccount.role == 'admin') {
                const filter = { email: email }
                const updateDoc = {
                    $set: { role: 'admin' }
                }
                const result = await Usercollection.updateOne(filter, updateDoc)
                res.send(result)
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access', erorCode: 403 })
            }

        })

        // Put User On mongo server
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email
            const user = req.body
            const filter = { email: email }
            const options = { upsert: true }
            const updateDoc = {
                $set: user
            }
            const result = await Usercollection.updateOne(filter, updateDoc, options)
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET);
            res.send({ result, token })
        })

        // My Booking
        app.get('/mybooking', verifyJwt, async (req, res) => {
            const email = req.query.email
            const authorization = req.headers.authorization
            const decodedEmail = req.decoded.email
            if (email === decodedEmail) {
                const query = { email: email };
                const booking = await Bookingcollection.find(query).toArray()
                res.send(booking)
            }
            else {
                return res.status(403).send({ message: 'Forbidden Access' })
            }

        })
        // Add or post Booking
        app.post('/booking', async (req, res) => {
            const booking = req.body

            const query = { tratment: booking.tratment, date: booking.date, slot: booking.slot, name: booking.name }
            const exist = await Bookingcollection.findOne(query);
            if (exist) {
                return res.send(
                    { success: false, addedCode: booking.tratmentId, booking }
                )

            }
            else {
                const result = await Bookingcollection.insertOne(booking);
                res.send({ success: true, addedCode: booking.tratmentId, booking, result })

            }

        })

        // Available space api

        app.get('/available', async (req, res) => {
            const date = req.query.date
            // get all service
            const services = await Servicescollection.find().toArray()
            // get only date
            const query = { date: date }
            const bookings = await Bookingcollection.find(query).toArray()
            // Get Each Service
            services.forEach(service => {
                // Find the booking for each service
                const serviceBookigngs = bookings.filter(book => book.tratment === service.name)
                // select slots for 
                const booked = serviceBookigngs.map(book => book.slot)

                const available = service.slots.filter(slot => !booked.includes(slot))
                service.slots = available
            })

            res.send(services)
        })



        // Dlete All Data
        app.delete('/deleteall', async (req, res) => {
            const query = {};
            const result = await Bookingcollection.deleteMany(query);
            res.send(result)

        })


    }
    finally {

        //   await client.close();
    }
}
run().catch(console.dir);


app.get('/', (req, res) => {
    res.send('One Doctor Server IS Running')
})
app.listen(port, () => {
    console.log("server is  running on ", port);
}) 