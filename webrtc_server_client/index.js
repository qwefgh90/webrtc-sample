const https = require('https');
const os = require('os');
const socketIO = require('socket.io');
const nodeStatic = require('node-static');
const fs = require('fs');

const options = {
    key: fs.readFileSync('../cert/webrtc.com.key.pem'),
    cert: fs.readFileSync('../cert/webrtc.com.crt.pem'),
}

let fileServer = new(nodeStatic.Server)();
let app = https.createServer(options, (req,res)=>{
    fileServer.serve(req,res);
}).listen(20000);

let io = socketIO.listen(app);
io.sockets.on('connection',socket=>{
    // function log() {
    //     let array = ['Message from server:'];
    //     array.push.apply(array,arguments);
    //     socket.emit('log',array);
    // }


    socket.on('message', message=>{
        console.log(`Client said ${message} from ${socket}`);
        socket.broadcast.emit('message', message);
    });

    socket.on('create or join',room=>{
        let clientsInRoom = io.sockets.adapter.rooms[room];
        let numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
        socket.emit('log', 'Room ' + room + ' has ' + numClients + ' client(s)');
        
        if(numClients === 0){
            console.log('A new room has been created.');
            socket.join(room);
            socket.emit('log', `You (${socket.id})` + ` created the room (${room})`);
            socket.emit('owned', room, socket.id);
        }
        else if(numClients===1){
            console.log('A second client enter the room.');
            socket.emit('log', `You (${socket.id})` + ` joined the room (${room})`);
            io.sockets.in(room).emit('notify', room);
            socket.join(room);
            socket.emit('joined', room, socket.id);
            io.sockets.in(room).emit('ready');
        }else{
            socket.emit('full',room);
        }
    });


});
