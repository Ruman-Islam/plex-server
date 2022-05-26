const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


//? Middleware
app.use(cors());
app.use(express.json());


// ? Database connection configuration
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vzdnu.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


// ? Verify token function
const verifyJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).send('Unauthorized Access')
    }
    const token = authHeader.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ success: false, message: 'Forbidden Access' })
        }
        req.decoded = decoded;
        next();
    });

}


const run = async () => {
    try {
        await client.connect();
        const productCollection = client.db("PLEX").collection("products");
        const bookingCollection = client.db("PLEX").collection("bookings");
        const paymentCollection = client.db("PLEX").collection("payments");
        const reviewCollection = client.db("PLEX").collection("reviews");
        const usersInfoCollection = client.db("PLEX").collection("usersInfo");

        // ? Admin Verifier
        const verifyAdmin = async (req, res, next) => {
            const requester = req.decoded.email;
            const requesterAccount = await usersInfoCollection.findOne({ email: requester });
            if (requesterAccount.role === 'admin') {
                next();
            } else {
                res.status(403).send({ success: false, message: 'Forbidden' })
            }
        }


        // ? Generate JWT
        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const filter = { email: email };
            const updatedDoc = { $set: { userInfo: { email: email } } };
            const options = { upsert: true };
            const result = await usersInfoCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' })
            res.send({ result, accessToken: token });
        })


        // ? Verify Admin
        // http://localhost:5000/admin/:email
        app.get('/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            const decodedEmail = req.decoded.email;
            if (decodedEmail === email) {
                const user = await usersInfoCollection.findOne({ email: email });
                const isAdmin = user.role === 'admin';
                res.send({ admin: isAdmin });
            } else {
                res.status(401).send({ success: false, message: 'Forbidden' })
            }
        })

        // ^ Admin works
        // ? Make admin
        // http://localhost:5000/add-admin/:email
        app.put('/add-admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const requesterEmail = req.params.email;
            const decodedEmail = req.decoded.email;
            const filter = req.body;
            if (decodedEmail === requesterEmail) {
                const updatedDoc = { $set: { role: 'admin' } };
                const result = await usersInfoCollection.updateOne(filter, updatedDoc);
                res.send(result);
            }
        })


        // ? Remove admin
        // http://localhost:5000/remove-admin/:email
        app.put('/remove-admin/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const requesterEmail = req.params.email;
            const decodedEmail = req.decoded.email;
            const filter = req.body;
            if (filter.email === 'rumanislam0429@gmail.com') {
                return res.send({ success: false, message: "Don't try to remove super admin!!" })
            }
            if (decodedEmail === requesterEmail) {
                const updatedDoc = { $set: { role: 'user' } };
                const result = await usersInfoCollection.updateOne(filter, updatedDoc);
                res.send({ success: true, result });
            }
        })


        // ? Delete a user
        // http://localhost:5000/delete-user/:email
        app.delete('/delete-user/:email', verifyJWT, verifyAdmin, async (req, res) => {
            const requesterEmail = req.params.email;
            const decodedEmail = req.decoded.email;
            const filter = req.body;
            if (filter.email === 'rumanislam0429@gmail.com') {
                return res.send({ success: false, message: "Don't try to delete super admin!!" })
            }
            if (decodedEmail === requesterEmail) {
                const result = await usersInfoCollection.deleteOne(filter);
                res.send({ success: true, result })
            } else {
                res.status(401).send({ success: false, message: 'Forbidden' })
            }
        })



        // ? Get all users
        // http://localhost:5000/all-user
        app.get('/all-user', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (decodedEmail === email) {
                const users = await usersInfoCollection.find().toArray();
                res.send({ success: true, users })
            } else {
                res.status(401).send({ success: false, message: 'Forbidden' })
            }
        })


        // ? Add product
        // http://localhost:5000/add-product
        app.post('/add-product', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            const productInfo = req.body;
            if (decodedEmail === email) {
                const result = await productCollection.insertOne(productInfo);
                res.send({ success: true, result });
            } else {
                res.status(401).send({ success: false, message: 'Forbidden' });
            }
        })


        // ? Get all orders
        // http://localhost:5000/all-order
        app.get('/all-orders', verifyJWT, verifyAdmin, async (req, res) => {
            const email = req.query.email;
            const decodedEmail = req.decoded.email;
            if (decodedEmail === email) {
                const result = await bookingCollection.find().toArray();
                res.send({ success: true, result });
            } else {
                res.status(401).send({ success: false, message: 'Forbidden' });
            }
        })



        // ? Shipment update
        // http://localhost:5000/shipment-update
        app.put('/shipment-update/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const { email } = req.body;
            const decodedEmail = req.decoded.email;
            const updatedDoc = {
                $set: {
                    deliveryStatus: true
                }
            }
            if (decodedEmail === email) {
                const result = await bookingCollection.updateOne(filter, updatedDoc);
                res.send({ success: true, result });
            } else {
                res.status(401).send({ success: false, message: 'Forbidden' });
            }
        })


        // ? Delete order
        // http://localhost:5000/delete-order
        app.delete('/delete-order/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const { email } = req.body;
            const decodedEmail = req.decoded.email;
            if (decodedEmail === email) {
                const result = await bookingCollection.deleteOne(filter);
                res.send({ success: true, result });
            } else {
                res.status(401).send({ success: false, message: 'Forbidden' });
            }
        })


        // ? Delete product
        // http://localhost:5000/delete-product
        app.delete('/delete-product/:id', verifyJWT, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const { email } = req.body;
            const decodedEmail = req.decoded.email;
            if (decodedEmail === email) {
                const result = await productCollection.deleteOne(filter);
                res.send({ success: true, result });
            } else {
                res.status(401).send({ success: false, message: 'Forbidden' });
            }
        })
        // ^ Admin works


        // ? All products
        // http://localhost:5000/products
        app.get('/products', async (req, res) => {
            const query = req.query;
            const result = await productCollection.find(query).toArray();
            console.log(result.length);
            res.send(result);
        })


        // ? Find single product for purchase page
        // http://localhost:5000/product/:id
        app.get('/product/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) }
            const result = await productCollection.findOne(query);
            res.send(result);
        })


        // ? Get payment intent client secret from stripe
        // http://localhost:5000/create-payment-intent
        app.post('/create-payment-intent', async (req, res) => {
            const product = req.body;
            const price = product.price;
            const amount = price * 100;
            try {
                const paymentIntent = await stripe.paymentIntents.create({
                    amount: amount,
                    currency: 'usd',
                    payment_method_types: ['card']
                });
                res.send({ clientSecret: paymentIntent.client_secret })
            } catch (error) {
                console.log(error);
            }
        })


        // ? Payment update
        // http://localhost:5000/booking/${_id}`
        app.patch('/booking/:id', async (req, res) => {
            const id = req.params.id;
            const payment = req.body;
            const filter = { productId: id };
            const updatedDoc = {
                $set: {
                    paymentStatus: true,
                    transactionId: payment.transactionId
                }
            }
            const result = await paymentCollection.insertOne(payment);
            const updatedBooking = await bookingCollection.updateOne(filter, updatedDoc);
            const booking = await bookingCollection.findOne({ transactionId: payment.transactionId });
            res.send(booking);
        })


        // ? Add booking product
        // http://localhost:5000/book-product
        app.post('/book-product', async (req, res) => {
            const booking = req.body;
            const query = {
                name: booking.name,
                email: booking.email,
                productName: booking.productName,
                price: booking.price,
                date: booking.date
            }

            const exists = await bookingCollection.findOne(query);
            if (exists) {
                return res.send({ success: false, booking: exists })
            } else {
                const result = await bookingCollection.insertOne(booking);
                // sendAppointmentEmail(booking);
                return res.send({ success: true, result });
            }
        })


        // ? My bookings
        // http://localhost:5000/my-orders
        app.get('/user/my-orders', async (req, res) => {
            const email = req.query.email;
            const query = { email: email }
            const orders = await bookingCollection.find(query).toArray();
            if (!(orders.length === 0)) {
                res.send({ success: true, orders })
            } else {
                res.send({ success: false, message: 'No orders' })
            }
        })


        // ? Delete order
        // http://localhost:5000/delete-order
        app.delete('/delete-order/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) };
            const result = await bookingCollection.deleteOne(filter);
            res.send(result);
        })


        // ? Add review
        // http://localhost:5000/add-review
        app.post('/add-review', async (req, res) => {
            const review = req.body;
            const result = await reviewCollection.insertOne(review);
            res.send({ success: true, result });
        })


        // ? Delete review
        // http://localhost:5000/get-review
        app.get('/get-review', async (req, res) => {
            const query = req.query;
            const reviews = await reviewCollection.find(query).toArray();
            res.send({ success: true, reviews });
        })


        // ? Add user info
        // http://localhost:5000/add-userInfo
        app.put('/add-userInfo', async (req, res) => {
            const email = req.query.email;
            const userInfo = req.body;
            const filter = { email: email };
            const updatedDoc = { $set: { userInfo } };
            const options = { upsert: true };
            const result = await usersInfoCollection.updateOne(filter, updatedDoc, options);
            res.send({ success: true, result });
        })


        // ? Get user info
        // http://localhost:5000/get-userInfo
        app.get('/get-userInfo', async (req, res) => {
            const email = req.query.email;
            const filter = { email: email };
            const result = await usersInfoCollection.findOne(filter);
            res.send({ success: true, result });
        })

    } finally {
        // await client.close();
    }
}
run().catch(console.dir);

// http://localhost:5000/
app.get('/', (req, res) => {
    res.send('Server is running well')
})

app.listen(port, () => {
    console.log('Plex server is running on port -', port);
})
// https://mysterious-harbor-14588.herokuapp.com/