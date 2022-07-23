// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

const { ActivityHandler, MessageFactory } = require('botbuilder');

const { QnAMaker } = require('botbuilder-ai');
const DentistScheduler = require('./dentistscheduler');
const IntentRecognizer = require('./intentrecognizer');

class DentaBot extends ActivityHandler {
    constructor(configuration, qnaOptions) {
        // call the parent constructor
        super();
        if (!configuration) throw new Error('[QnaMakerBot]: Missing parameter. configuration is required');

        // create a QnAMaker connector
        this.qnAMaker = new QnAMaker(configuration.QnAConfiguration);
        // create a DentistScheduler connector
        this.dentistScheduler = new DentistScheduler(configuration.SchedulerConfiguration);
        // create a IntentRecognizer connector
        this.intentRecognizer = new IntentRecognizer(configuration.LuisConfiguration);

        this.onMessage(async (context, next) => {
            try {
            // send user input to QnA Maker and collect the response in a variable
            // don't forget to use the 'await' keyword
                const answers = await this.qnAMaker.getAnswers(context);
                // send user input to IntentRecognizer and collect the response in a variable
                // don't forget 'await'
                const result = await this.intentRecognizer.executeLuisQuery(context);
                // const topIntent = result.luisResult.prediction.topIntent;
                // determine which service to respond with based on the results from LUIS //

                // if(top intent is intentA and confidence greater than 50){
                //  doSomething();
                //  await context.sendActivity();
                //  await next();
                //  return;
                // }
                // else {...}
            if (result.luisResult.prediction.topIntent === "getAvailability" &&
                result.intents.getAvailability.score > 0.5
            ) {
                const availableSlots = await this.dentistScheduler.getAvailability();
                await context.sendActivity(availableSlots);
                await next();
                return;
            } 
            else if (result.luisResult.prediction.topIntent === "scheduleAppointment" &&
                     result.intents.scheduleAppointment.score > 0.5 &&
                     result.entities.$instance && 
                     result.entities.$instance.slot && 
                     result.entities.$instance.slot[0]
            ){
                const timeSlot = result.entities.$instance.slot[0].text;
                const schedulerResponse = await this.dentistScheduler.scheduleAppointment(timeSlot);
                await context.sendActivity(MessageFactory.text(schedulerResponse, schedulerResponse));
                await next();
                return;
            }

            if (answers[0]) {
                await context.sendActivity(MessageFactory.text(`${answers[0].answer}`,`${answers[0].answer}`));
                
            }
            else {
                // If no answers were returned from QnA Maker, reply with help.
                await context.sendActivity('your question is not clear' + 
                'I can provide the list of available slots' +
                 'Or you can ask me to make a reservation for a given time slot\n');
            }

                // await context.sendActivity(MessageFactory.text(message, message));
            } catch (e) {
                console.error(e);
            }
            await next();
        });

        this.onMembersAdded(async (context, next) => {
            const membersAdded = context.activity.membersAdded;
            // write a custom greeting
            const greetingText = 'Hello welcome to Contonso Dentistry, how may i help you?';
            for (let cnt = 0; cnt < membersAdded.length; ++cnt) {
                if (membersAdded[cnt].id !== context.activity.recipient.id) {
                    await context.sendActivity(MessageFactory.text(greetingText, greetingText));
                }
            }
            // by calling next() you ensure that the next BotHandler is run.
            await next();
        });
    }
}

module.exports.DentaBot = DentaBot;
