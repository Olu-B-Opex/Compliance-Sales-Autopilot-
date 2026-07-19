const TEMPLATE_ID = "1sJipV5B7QYjgzN0rRtBkMF1_pwmur63PhqlkEoeBFIw";

const DESTINATION_FOLDER_ID = "1AUy7LaVvw8RpqE30rGxIvv0eoEuLZnLm";



function onEdit(e) {
  
   const sheet = e.source.getActiveSheet();
   if (sheet.getName() !== "Leads") return;

  const row = e.range.getRow();



  // Only trigger when Qualification column (Column B) is edited

  // Only run when Status (Column H) changes
if (e.range.getColumn() !== 8) return;

const status = sheet.getRange(row, 8).getValue();

if (status !== "Qualified") return;

// Don't generate twice
if (sheet.getRange(row, 9).getValue() === "Yes") return;

createProposal(sheet, row);


}
function createProposal(sheet, row) {

  const organization = sheet.getRange(row, 2).getValue();

  const email = sheet.getRange(row, 5).getValue();
  const contactName = sheet.getRange(row, 4).getValue();
  const serviceNeeded = sheet.getRange(row, 7).getValue();

  const today = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "dd MMMM yyyy"
  );

  const folder = DriveApp.getFolderById(DESTINATION_FOLDER_ID);

  const copy = DriveApp
      .getFileById(TEMPLATE_ID)
      .makeCopy(organization + " Proposal", folder);

  const doc = DocumentApp.openById(copy.getId());

  const body = doc.getBody();

  body.replaceText("{{organization_name}}", organization);
  body.replaceText("{{date}}", today);

  doc.saveAndClose();

  const pdf = DriveApp
  .getFileById(copy.getId())
  .getAs(MimeType.PDF);

  const subject = "Proposal for " + organization;

MailApp.sendEmail({
  to: email,
  subject: subject,
  htmlBody:
    "<p>Dear " + contactName + ",</p>" +
    "<p>Thank you for your interest in our " + serviceNeeded + " services.</p>" +
    "<p>Please find attached our proposal prepared for <strong>" + organization + "</strong>.</p>" +
    "<p>We look forward to discussing how we can support your organisation.</p>" +
    "<p>Kind regards,<br>RegTech365</p>",
  attachments: [pdf]
});

// Give Gmail a moment to index the sent message
Utilities.sleep(3000);

// Find the sent conversation
const threads = GmailApp.search(
  'in:sent subject:"' + subject + '" newer_than:1d'
);

if (threads.length > 0) {
  sheet.getRange(row, 17).setValue(threads[0].getId()); // Column Q
}

try {

  const industry = sheet.getRange(row, 3).getValue();

  const aiFollowUp = generateFollowUpWithQwen(
      organization,
      industry,
      serviceNeeded,
      contactName
  );

  const followUpDocUrl = saveFollowUpToGoogleDoc(
      organization,
      aiFollowUp
  );

  // Store only the document link
  sheet.getRange(row, 14).setValue(followUpDocUrl);

} catch(err) {

  Logger.log(err);

  sheet.getRange(row, 14).setValue("Qwen Error");

}
   
  sheet.getRange(row, 9).setValue("Yes");
sheet.getRange(row, 10).setValue(doc.getUrl());
sheet.getRange(row, 11).setValue(new Date());
sheet.getRange(row, 12).setValue("Yes");
sheet.getRange(row, 13).setValue(new Date());

}


function authorizeServices() {
  DriveApp.getRootFolder();
  GmailApp.getAliases();
}

function generateFollowUpWithQwen(organization, industry, serviceNeeded, contactName) {

  const apiKey = PropertiesService
      .getScriptProperties()
      .getProperty("DASHSCOPE_API_KEY");

  const url = "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions";

  const prompt =
`You are a professional business development consultant.

Write a follow-up email for a prospective client.

Organization: ${organization}
Industry: ${industry}
Service Requested: ${serviceNeeded}
Contact Person: ${contactName}

The proposal was emailed three days ago.

Write a professional follow-up email.

The email should:

- Be warm and consultative.
- Be addressed to the contact person.
- Mention that a proposal was sent three days ago.
- Encourage a short 15-minute discovery meeting.
- Do not sound pushy.
- Maximum 180 words.

IMPORTANT:

The sender is RegTech365, a regulatory compliance consulting firm.

Do NOT sign the email as the client organization.

Finish with:

Kind regards,

RegTech365
Business Development Team

Return only the email body.`;

  const payload = {
  model: "qwen3-32b",

  enable_thinking: false,

  messages: [
    {
      role: "system",
      content: "You are an expert consulting sales assistant."
    },
    {
      role: "user",
      content: prompt
    }
  ]
};

  const options = {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: "Bearer " + apiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch(url, options);

Logger.log(response.getContentText());

const json = JSON.parse(response.getContentText());

if (!json.choices) {
  throw new Error(response.getContentText());
}

return json.choices[0].message.content;

};

function saveFollowUpToGoogleDoc(organization, followUpText) {

  const folder = DriveApp.getFolderById(DESTINATION_FOLDER_ID);

  const doc = DocumentApp.create(organization + " AI Follow-up");

  doc.getBody().setText(followUpText);

  doc.saveAndClose();

  const file = DriveApp.getFileById(doc.getId());

  folder.addFile(file);

  // Optional: remove it from My Drive root
  DriveApp.getRootFolder().removeFile(file);

  return doc.getUrl();

}



function testQwen() {

  const email = generateFollowUpWithQwen(
      "ABC Bank",
      "Financial Services",
      "AML Compliance",
      "John Doe"
  );

  Logger.log(email);

}

function hasClientReplied(threadId) {

  if (!threadId) return false;

  try {

    const thread = GmailApp.getThreadById(threadId);

    if (!thread) return false;

    const messages = thread.getMessages();

    // Get your Gmail address
    const myEmail = Session.getActiveUser().getEmail().toLowerCase();

    // Start from the second message
    // (the first one is the proposal you sent)
    for (let i = 1; i < messages.length; i++) {

      const sender = messages[i].getFrom().toLowerCase();

      // If sender is NOT you, the client replied
      if (!sender.includes(myEmail)) {
        return true;
      }

    }

    return false;

  } catch(err) {

    Logger.log(err);

    return false;

  }

}

function followUpAutomation() {

  const sheet = SpreadsheetApp
      .getActiveSpreadsheet()
      .getSheetByName("Leads");

  const lastRow = sheet.getLastRow();

  for (let row = 2; row <= lastRow; row++) {

    const email = sheet.getRange(row, 5).getValue();

    const serviceNeeded = sheet.getRange(row, 7).getValue();

    const organization = sheet.getRange(row, 2).getValue();

    const contactName = sheet.getRange(row, 4).getValue();

    const proposalDate = sheet.getRange(row, 13).getValue(); // Column M (Date Sent)

    const followUpLink = sheet.getRange(row, 14).getValue(); // Column N

    const followUpSent = sheet.getRange(row, 15).getValue(); // Column O

    const threadId = sheet.getRange(row, 17).getValue(); // Column Q

    // Skip if already sent
    if (followUpSent === "Yes") continue;

    // Skip if proposal has never been emailed
    if (!(proposalDate instanceof Date)) continue;

    const today = new Date();

    const days =
      Math.floor((today - proposalDate) / (1000 * 60 * 60 * 24));

    // Wait 3 days
    if (days < 3) continue;

    if (hasClientReplied(threadId)) {

  sheet.getRange(row, 15).setValue("Client Replied");

  Logger.log(organization + " has already replied.");

  continue;

}

    try {

      // Extract Google Doc ID from URL
      const docId =
        followUpLink.match(/[-\w]{25,}/)[0];

      const doc =
        DocumentApp.openById(docId);

      const body =
        doc.getBody().getText();

      MailApp.sendEmail({

        to: email,

        subject: organization + " - Follow-up on your " + serviceNeeded + " proposal",
        

        htmlBody:
          body.replace(/\n/g, "<br>")

      });

      // Mark as sent
      sheet.getRange(row, 15).setValue("Yes");

      sheet.getRange(row, 16).setValue(new Date());

      Logger.log("Follow-up sent to " + organization);

    }

    catch(err){

      Logger.log(err);

    }

  }

}
