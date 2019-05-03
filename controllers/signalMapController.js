const {SignalMap, validate, estimateNearestNeighbors} = require("../models/signalMap");
const {Room} = require("../models/room");
const {Beacon} = require("../models/beacon");

const createSignalMap = async (req, res) => {
    const {error} = validate(req.body);

    if (error) return res.status(400).send(error.details[0].message);

    const {beacons, buildingId, roomId} = req.body;
    let estimatedRoomId;

    for (let i = 0; i < beacons.length; i++) {
        const beacon = await Beacon.findById(beacons[i].beaconId);
        if (!beacon) return res.status(400).send(`Beacon with id ${beacons[i].beaconId} did not exist in database`);
        beacons[i]._id = beacons[i].beaconId;
    }

    if (!roomId) {
        if (!buildingId) res.status(400).send("Please provide either roomId or buildingId");

        let signalMaps = await SignalMap.find({isActive: true});
        if (signalMaps.length <= 0) return res.status(400).send("Unable to estimate room when no active signalMaps " +
          "was found in database");

        for (let i = 0; i < signalMaps.length; i++) {
            const room = await Room.findById(signalMaps[i].room);
            console.log('roombuild: ', room.building);
            console.log('buildingId: ', buildingId);
            if (room.building.toString() !== buildingId.toString()) {
                signalMaps.splice(i, 1);
                i--;
            }
        }
        console.log('siiig: ', signalMaps);

        const serverBeacons = await Beacon.find({building: buildingId});
        if (!serverBeacons || serverBeacons.length <= 0)
            return res.status(400).send("Was unable to find beacon with building id " + buildingId);

        const beaconIds = [];
        for (let i = 0; i < serverBeacons.length; i++) {
            beaconIds.push(serverBeacons[i]._id);
        }
        console.log("bids", beaconIds);
        estimatedRoomId = await estimateNearestNeighbors(beacons, signalMaps, 3, beaconIds);
    } else {
        const signalMap = await SignalMap.findOne({room: roomId});
        if(signalMap)
            return res.status(400).send("There is already a signalmap for the given room");
    }

    let signalMap = new SignalMap({
        room: roomId || estimatedRoomId,
        beacons,
        isActive: !!roomId
    });
    signalMap = await signalMap.save();
    res.send(signalMap);
};

const confirmRoom = async (req, res) => {
    const id = req.params.id;
    const signalMap = await SignalMap.findByIdAndUpdate(id, {
        $set: {
            isActive: true
        },
    }, {new: true});

    if (!signalMap) return res.status(404).send(`signalMap with id ${id} was not found in database`);
    res.send(signalMap);
};

module.exports.createSignalMap = createSignalMap;
module.exports.confirmRoom = confirmRoom;
