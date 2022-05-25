const express = require('express');
const cors = require('cors');
// const jwt = require('jsonwebtoken');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);


// Middleware
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.vzdnu.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });


const run = async () => {
    try {
        await client.connect();
        const productCollection = client.db("PLEX").collection("products");
        const bookingCollection = client.db("PLEX").collection("bookings");
        const paymentCollection = client.db("PLEX").collection("payments");
        const reviewCollection = client.db("PLEX").collection("reviews");


        // ? All products
        // http://localhost:5000/products
        app.get('/products', async (req, res) => {
            const query = req.query;
            const result = await productCollection.find(query).toArray();
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
        app.get('/my-orders', async (req, res) => {
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
