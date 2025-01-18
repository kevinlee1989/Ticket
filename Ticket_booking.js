const { DynamoDBClient, ListTablesCommand, CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, GetCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
require('dotenv').config();

const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({
  region: "us-west-2",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_SECRET_KEY,
  }
});
const docClient = DynamoDBDocumentClient.from(client);


const BookingTickets = async (eventBody) => {

  const request = JSON.parse(eventBody); // requestBody = JSON.parse(eventBody);

  const { TIDValue } = request;

  const param = {
    TableName: 'Ticket',
    Key: {
      TID: TIDValue
    }
  };
  
  const ticketData = docClient.send(new GetCommand(param));

// 키 밸류를 알면 그 안에 속성을 변경하는 로직
  const updateParams = {
    TableName: 'Ticket',
    Key: {
      TID: TIDValue  // 티켓의 TID
    },
    UpdateExpression: "set #status = :status",
    ExpressionAttributeNames: {
      "#status": "Status"  // 예약어인 Status를 대체
    },
    ExpressionAttributeValues: {
      ":status": "sold"  // 티켓 상태를 'sold'로 설정
    },
    ReturnValues: "ALL_NEW"
  };
  
  const updateResult = await docClient.send(new UpdateCommand(updateParams));
  console.log("티켓 상태 업데이트 성공:", updateResult);

  return { success: true, updatedTicket: updateResult.Attributes };
}


exports.handler = async (event) => {
  
  console.log("000: ", event.body);
  // 티켓 상태를 'sold'로 업데이트하는 함수 호출
  const result = await BookingTickets(event.body);
  console.log("111: ", result);
  if (result.success) {
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: "티켓 상태가 'sold'로 업데이트되었습니다.",
        updatedTicket: result.updatedTicket
      })
    };
  } else {
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "티켓 상태 업데이트 실패", error: result.error })
    };
  }
};