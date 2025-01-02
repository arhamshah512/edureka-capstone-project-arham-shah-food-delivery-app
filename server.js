// @ts-check

import express from 'express'
import cors from 'cors'
const app = express()
import { readFile } from 'fs/promises'
import mongoose, { mongo } from 'mongoose'
import { type } from 'os'

mongoose.connect('mongodb://localhost:27017/edureka_capstone_project_food_delivery_app_arham')

app.use(cors())
app.use(express.json())

const isSavedEntrySchema = new mongoose.Schema({
	userId: String,
	isSaved: {
		type: Boolean,
		default: false
	},
	foodListingId: String,
})

const FoodListingSchema = new mongoose.Schema({
	name: String,
	type: String,
	cuisine: String,
	price: Number,
	mealSuitability: String,
	restaurantId: String,
	imageSource: String,
	isSavedEntries: [isSavedEntrySchema]
})

const FoodListing = mongoose.model('FoodListing', FoodListingSchema)

const RestaurantSchema = new mongoose.Schema({
	name: String,
	cuisines: String,
	description: String,
	address: String,
})

const Restaurant = mongoose.model('Restaurant', RestaurantSchema)

const FoodListingOrderSchema = new mongoose.Schema({
	foodListingId: String,
	quantity: Number,
	price: Number,
	cartId: String
})

const FoodListingOrder = mongoose.model('FoodListingOrder', FoodListingOrderSchema)

const CartSchema = new mongoose.Schema({
	userId: String,
	orderIds: [String],
}, { timestamps: true })

const Cart = mongoose.model('Cart', CartSchema)

const UserSchema = new mongoose.Schema({
	name: String,
	username: String,
	hashedPasscode: String,
	cartIds: [String]
})

const User = mongoose.model('User', UserSchema)

app.get('/get-food-listings', async (req, res) => {
	res.json(await FoodListing.find())
})

app.get('/get-restaurants', async (req, res) => {
	res.json(await Restaurant.find())
})

app.post('/add-order', async (req, res) => {
	const details = req.body

	const newOrder = new FoodListingOrder(details)
	await newOrder.save()

	const cart = await Cart.findById(details.cartId)

	await Cart.findByIdAndUpdate(req.body.cartId, {
		// @ts-ignore
		orderIds: [...cart.orderIds, newOrder._id]
	})

	res.status(201).send({ newOrderId: newOrder._id })
})

app.delete('/remove-order', async (req, res) => {
    try {
        await FoodListingOrder.findByIdAndDelete(req.body.orderId)

        await Cart.updateOne(
            { _id: req.body.cartId },
            { $pull: { orderIds: req.body.orderId } }
        )

        res.status(204).send()
    } catch (error) {
        console.error('Error removing order:', error)
        res.status(500).send({ error: 'Failed to remove order' })
    }
})

app.put('/update-order-quantity', async (req, res) => {
	const { foodListingId, orderId, cartId, quantity } = req.body

	console.log(orderId)

	// @ts-ignore
	const updatedOrder = await FoodListingOrder.findByIdAndUpdate(orderId, { quantity })

	res.status(200).send(updatedOrder?.toObject())
})

app.put('/update-is-saved-status', async (req, res) => {
	const { foodListingId, isSaved, userId } = req.body
	const foodListing = await FoodListing.findById(foodListingId)

	if (foodListing?.isSavedEntries?.some?.(entry => entry.userId === userId)) {
		await foodListing?.updateOne({
			// @ts-ignore
			isSavedEntries: foodListing.isSavedEntries.with(
				foodListing.isSavedEntries.findIndex(entry => entry.userId === userId),
				{ userId, isSaved, foodListingId}
			)
		})
	} else {
		await foodListing?.updateOne({
			isSavedEntries: [...foodListing.isSavedEntries, { userId, isSaved, foodListingId}]
		})
	}

	res.status(204)
})


app.get('/get-food-listing-orders', async (req, res) => {
	res.json(await FoodListingOrder.find())
})

app.get('/get-carts', async (req, res) => {
	res.json(await Cart.find())
})

app.get('/get-cart-by-id/:id', async (req, res) => {
	res.json(await Cart.findById(req.params.id))
})

app.post('/create-cart', async (req, res) => {
	const { userId } = req.body

	const cart = new Cart({ userId, orderIds: [] })
	await cart.save()

	await User.findByIdAndUpdate(userId, { $push: { cartIds: cart._id } })

	res.status(201).json(cart.toObject())
})

app.post('/create-account', async (req, res) => {
	const { name, username, hashedPasscode } = req.body

	const users = await User.find()

	const usernames = users.map(user => user.username)

	if (usernames.includes(req.body.username)) {
		res.status(401).json({ message: 'Username already exists' })
		return
	}

	const user = new User({ name, username, hashedPasscode, cartIds: [] })
	await user.save()

	res.status(201).json(user._id)
})

app.post('/login', async (req, res) => {
	const users = await User.find()

	const usernames = users.map(user => user.username)

	if (!usernames.includes(req.body.username)) {
		res.json({ error: 'Username not found' })
		return
	}

	if (users.find(user => user.username === req.body.username)?.hashedPasscode !== req.body.hashedPasscode) {
		res.json({ error: 'Passcode incorrect' })
		return
	}

	const user = await User.findOne({ username: req.body.username, hashedPasscode: req.body.hashedPasscode })
	const newCart = new Cart({ userId: user?._id, orderIds: [] })
	await newCart.save()

	if (user?.cartIds.length === 0) {
		console.log('Panda')

		User.findByIdAndUpdate(user._id, { cartIds: [newCart._id] })
			.then(() => {})
			.finally(() => {
				res.json({
					...user?.toObject(),
					cartIds: [newCart._id]
				})
			})
	} // @ts-ignore
	else if (user?.cartIds.length > 0) {
		//@ts-ignore
		User.findByIdAndUpdate(user._id, { cartIds: [...user?.cartIds, newCart._id] }).then(() => {
			res.json(user?.toObject())
		})
	}

	// if (user?.cartIds?.length === 0) {
	// 	await User.findByIdAndUpdate(user._id, { cartIds: [newCart._id] })
	// } else {
	// 	// @ts-ignore
	// 	await User.findByIdAndUpdate(user?._id, { cartIds: [...user?.cartIds, newCart._id] })
	// }
})

app.listen(3000, () => {
	console.log('Server running on http://localhost:3000')
})
