const {v4: uuid} = require('uuid');
const {validationResult} = require('express-validator');
const mongoose = require('mongoose');
const fs = require('fs');

const HttpError = require('../models/http-error');
const Place = require('../models/place');
const User = require('../models/user');

const getPlaceById =async (req, res, next) => {
    const placeId = req.params.pid;
    let place;
    try{
        place = await Place.findById(placeId);
    } catch (err) {
        const error = new HttpError(
            'Something went wrong, could not find a place.', 500
        );
        return next(error);
    }

    if(!place) {
        const error = new HttpError('Could not find a place for the provided id.', 404
        );
        return next(error);
     }

    res.json({place: place.toObject( {getters: true} )});
};


const getPlacesByuserId = async (req, res, next) => {
    const userId = req.params.uid;

    let userwithPlaces;
    try{
        userwithPlaces = await User.findById(userId).populate('places');
    } catch (err) {
        const error = new HttpError(
            'Fetching places failed, please try again later.', 500
        );
        return next(error);
    }


    if(!userwithPlaces || userwithPlaces.places.length === 0) {
        return next(
            new HttpError('Could not find a places for the provided user id.', 404)
        );
     }

    res.json({ places: userwithPlaces.places.map(place => place.toObject({ getters: true })) });
};

const createPlace = async (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
       const error = new HttpError('Invalid inputs passes, please check your data', 422);
       return next(error);
    }
    let coordinates = {
        "lat": 35.6365636,
        "lng": 139.7401022
      };
    const { title, description, address, creator } = req.body;

    const createdPlace = new Place({
        title,
        description,
        address,
        location: coordinates,
        image: req.file.path, 
        creator: req.userData.userId
    });

    let user;
    try {
        user = await User.findById(req.userData.userId);

    }catch (err) {
        const error = new HttpError(
            'Creating place failed, please try again',
            500
        );
        return next(error);
    }

    if(!user) {
        const error = new HttpError('Could not find user for provided Id', 404);
        return next(error);
    }
    console.log(user);

    try {
        const sess = await mongoose.startSession();
        sess.startTransaction();
        await createdPlace.save({session: sess});
        user.places.push(createdPlace);
        await user.save({session: sess});
        await sess.commitTransaction();
    } catch (err) {
        const error = new HttpError(
            'Creating place failed, please try again.',
            500
        );
        return next(error);
    }

    res.status(201).json({place: createdPlace});
};

const updatePlace = async (req, res, next) => {
    const errors = validationResult(req);
    if(!errors.isEmpty()) {
        const error = new HttpError('Invalid inputs passes, please check your data', 422);
        return next(error);
    }
    const placeId = req.params.pid;
    const {title, description } = req.body;

    let place;
    try{
        place = await Place.findById(placeId);
    } catch (err) {
        const error = new HttpError(
            'Something went wrong, could not update place', 500
        );
        return next(error);
    }

    if(place.creator.toString() != req.userData.userId) {
        const error = new HttpError(
            'You are not allowed to edit this place.',
            401
        );
        return next(error);
    }

    place.title = title;
    place.description = description;

    try {
        await place.save();
    } catch (err){
        const error = new HttpError(
            'Something went wrong, could not update place', 500
        );
        return next(error);
    };


    return res.status(200).json({place: place.toObject({ getters: true}) });
};

const deletePlace = async (req, res, next) => {
    const placeId = req.params.pid;

    let place;

    try{
        place = await Place.findById(placeId).populate('creator');
    } catch (err) {
        const error = new HttpError(
            'Something went wrong, could not delete place', 500
        );
        return next(error);
    }

    if(place.creator.id !== req.userData.userId) {
        const error = new HttpError(
            'You are not allowed to delete this place.',
            401
        );
        return next(error);
    }

    if(!place) {
        const error = new HttpError(' Could not find place for this id.', 404);
        return next(error);
    }

    const imagePath = place.image;

    try {
        //await Place.deleteOne({ _id: placeId });
        const sess = await mongoose.startSession();
        sess.startTransaction();
        place.creator.places.pull(place);
        await place.creator.save({session: sess});
        await Place.deleteOne({ _id: placeId }).session(sess);
        await sess.commitTransaction();
    } catch (err){
        console.log(err);
        const error = new HttpError(
            'Something went wrong, could not delete place', 500
        );
        return next(error);
    };

    fs.unlink(imagePath, err => {
        console.log(err);
    });

    res.status(200).json({message: 'Deleted place.'});
};

exports.getPlaceById = getPlaceById;
exports.getPlacesByuserId = getPlacesByuserId;
exports.createPlace = createPlace;
exports.updatePlace = updatePlace;
exports.deletePlace = deletePlace;
