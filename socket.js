const { decode } = require('jsonwebtoken');

class Socketer {
  constructor (io, db) {
    this.io = io;
    this.db = db;
    this.editor = {
      code: ''
    };
  };

  connection (socket) {
    console.log('A user with socket ' + socket.id + ' has entered.');

    // USER CONNECTS
    socket.on('user online', ({ token }) => this.updateOnlineUsers(token, socket));

    // USER DISCONNECTS
    socket.on('disconnect', () => this.updateOnlineUsers(null, socket));

    // JOIN ROOM
    socket.on('join room', (room) => this.joinRoom(room, socket));

    // CALL TUTOR
    socket.on('chat now', ({ question, learner }) => this.pushTutor(question, learner, socket));

    // SEND QUESTION TO TUTOR
    socket.on('question info', (data) => this.sendQuestionInfo(data));

    // CHAT
    socket.on('chat message', (msg) => this.io.to(msg.room).emit('chat message', msg));

    // EDITOR
    socket.on('editor', (data) => this.handleCodeSend(data, socket));

    // HANG UP
    socket.on('hang up', ({ roomId }) => this.hangUp(roomId));

    // UPDATE KARMA
    socket.on('update karma', (data) => this.io.sockets.connected[this.db.onlineUsers[data.tutor]].emit('update karma', data));

    // CANCEL CALL
    socket.on('cancel call', (tutor) => this.io.sockets.connected[this.db.onlineUsers[tutor]].emit('cancel call'));

    // UPDATE OFFERS
    socket.on('offer sent', ({ offer, learner_id }) => this.sentOffer(offer, learner_id, socket))

    // LOGOUT USER
    socket.on('offline user', (user) => db.onlineUsers[user] = undefined);
  }

  ////////////////////////
  // CALLBACK FUNCTIONS //
  ////////////////////////

  updateOnlineUsers(token, socket) {
    if (token) {
      this.db.onlineUsers[decode(token).user_id] = socket.id;
    } else {
      console.log(`The user with socket ${socket.id} has left.`);
      Object.keys(this.db.onlineUsers).map((value) => {
        if (this.db.onlineUsers[value] === socket.id) {
          this.db.onlineUsers[value] = undefined;
        }
      });
    }
    console.log('Online users:', this.db.onlineUsers);
  }

  joinRoom(room, socket) {
    console.log('User with socket ' + socket.id + ' just joined room ' + room);
    socket.join(room);
    const participants = this.io.sockets.adapter.rooms[room].length;
    this.io.in(room).emit('join room', participants);
  }

  pushTutor (question, learner) {
    // Emiting to an specific socketId
    this.db.onlineUsers[question.tutor] && this.io.sockets.connected[this.db.onlineUsers[question.tutor]].emit('push tutor', { question, learner });
  }

  sendQuestionInfo(data) {
    this.db.onlineUsers[data.tutor] && this.io.sockets.connected[this.db.onlineUsers[data.tutor]].emit('question info', data.question);
  }

  handleCodeSend (data, socket) {
    this.editor.code = data.code;
    socket.to(data.room).emit('editor', data);
  }

  hangUp (roomId) {
    // Sends a message back to the room stating which user hanged up --not yet implemented that way
    this.io.in(roomId).emit('hang up', 'username hang up.');
    // Disconnect all users from the room
    this.io.in(roomId).clients((err, clients) => {
      if (err) {
        console.log(err);
      }
      for (let i = 0; i < clients; i++) {
        this.io.sockets.connected[clients[i]].disconnect(true);
      }
    });
  }

  sentOffer (offer, learner_id) {
    const updateTutor = { user_id: offer.tutor, available: this.db.onlineUsers[offer.tutor]};
    this.db.onlineUsers[learner_id] && this.io.sockets.connected[this.db.onlineUsers[learner_id]].emit('offer sent', { offer, updateTutor});
  }

};

module.exports = Socketer
