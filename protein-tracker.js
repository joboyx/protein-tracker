UserData = new Mongo.Collection("userdata");
ProteinHistory = new Mongo.Collection("proteinhistory");

UserData.deny({
   update: function (userId, data) {
       if(data.total < 0) {
           return true;
       }
       return false;
   } 
});

UserData.allow({
    insert: function (userId, data) {
        if(userId == data.userId) {
            return true;
        }
        return false;
    },
    update: function (userId, data) {
        if(userId == data.userId) {
            return true;
        }
        return false;
    }
})

Meteor.methods({
    addAmount: function (amount) {

        //DEBUG
        //console.log("Meteor.userId()["+Meteor.userId()+"]");
        //console.log("this.userId["+this.userId+"]");
        //console.log(this);

        ProteinHistory.insert({
                userId: this.userId,
                value: amount,
                date: new Date()
            });
        
        UserData.update(
            {userId: this.userId}, {$inc: {total: amount}}
        );
    }
});

if (Meteor.isClient) {

    // Susbscribe to mongo db
    Meteor.subscribe("alluserdata");
    Meteor.subscribe("allproteinhistory");
    
    // Setup routes
    Router.route("/", function () {
        this.render("home");
    });
    Router.route("/settings", function () {
        this.render("settings");
    });

    // Route to 'home' if user logged out
    Meteor.autorun(function() {
        if(!Meteor.userId()) {
            Router.go("/");
        }
    });

    Template.userData.helpers({
        userData: function () {
            var data = UserData.findOne();
            
            if(!data) {
                data = {
                    userId: Meteor.userId(),
                    total: 0,
                    goal: 500
                };
                UserData.insert(data);
            }
            
            return data;
        },
        lastAmount: function () {
            if(Session.get("userId") == Meteor.userId()) {
                return Session.get("historyValue");
            }
        }
    });
    
    Template.userData.events({
        "click #addAmount, keypress #amount": function (e) {
                        
            if(e.charCode && e.charCode != 13) {
              return;
            }

            e.preventDefault();

            var amount = parseInt($("#amount").val());
            
            if(!amount) {
                alert("Add a valid value.");
                return;
            } else if(amount <= 0) {
                alert("Add a value greater than 0.");
                return;
            }
            
            Meteor.call("addAmount", amount, function (error, id) {
                if(error) {
                    console.log(error.reason);
                }
            });

            Session.set("historyValue", amount);
            Session.set("userId", Meteor.userId());
            
            //Clear "amount"
            ///$("#amount").val("");
        },

        //"keypress #amount": function (e) {
        //  if(e.charCode == 13) {
        //      clickAddAmount(e);
        //  }
        //},
        
        "click #undoLast": function (e) {
            e.preventDefault();
            
            // Find the last entry of the user and delete it
            var lastEntry = ProteinHistory.find(
                {userId: Meteor.userId()},
                {sort: {date: -1}, limit: 1}
            ).fetch()[0];
            if(lastEntry) {
                // Delete that last entry
                ProteinHistory.remove(lastEntry._id);
            
                // Subtract the last transaction from user' total
                UserData.update(
                    UserData.findOne()._id, {$inc: {total: -1 * lastEntry.value}});
            }
        }
    });
    
    Template.proteinHistory.helpers({
        history: function () {
            return ProteinHistory.find({}, {sort: {date: -1}, limit: 5});
        },
        historyCount: function () {
            return ProteinHistory.find({}).count();
        }
    });

    Template.settings.helpers({
        userData: function () {
            return UserData.findOne();
        }
    });

    Template.settings.events({
        "click #setGoal": function (e) {
            e.preventDefault();

            var value = parseInt($("#newGoal").val());

            UserData.update(UserData.findOne()._id, {$set: {goal: value}});
        },
        "click #clearTotal": function (e) {
            e.preventDefault();

            console.log("Clearing UserData.total");

            // Clear total in UserData
            UserData.update(UserData.findOne()._id, {$set: {total: 0}});

            // Clear ProteinHistory
            //ProteinHistory.remove({});
            Meteor.call('clearTotal');

            alert("Protein history was cleared");
        }
    })
}

if (Meteor.isServer) {
    
    // Publish mongo db data to client
    Meteor.publish("alluserdata", function () {
        return UserData.find({userId: this.userId});
    });
    Meteor.publish("allproteinhistory", function () {
        return ProteinHistory.find({userId: this.userId});
    });
    
    Meteor.startup(function () {      
        // do some startup stuff
        
      return Meteor.methods({
          clearTotal: function () {
              return ProteinHistory.remove({userId: this.userId});
          }
      });

    });
}
