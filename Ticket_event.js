const { DynamoDBClient, ListTablesCommand, CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, GetCommand, ScanCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const redis = require('redis');


//Redis Cloud 연결
const client1 = redis.createClient({
  url: 'redis://:8wtVVC2mVo2UgcGBOW0OJle1VbQZAV29@redis-14200.c1.us-west-2-2.ec2.redns.redis-cloud.com:14200'
});
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



// Venue 테이블에서 SEATS 값을 조회하는 함수
const getVenueSeats = async (venueId) => {
    const param = {
      TableName: 'Venue',  // Venue 테이블
      Key: {
        ID: venueId  // Venue의 ID로 조회
      }
    };
  
    try {
      // Venue 조회
      const data = await docClient.send(new GetCommand(param));
      console.log("Venue 조회 성공:", data);
  
      // 좌석 수(SEATS) 반환
      if (data.Item && data.Item.Seats) {
        return { success: true, seats: data.Item.Seats };
      } else {
        return { success: false, error: "SEATS 정보 없음" };
      }
    } catch (error) {
      console.error("Venue 조회 실패:", error);
      return { success: false, error: error.message };
    }
  };

// 티켓 table을 만들어주는 함수
const MakeTicketTable = async (eventBody) => {
  console.log("123123123123123123123123");
  const data2 = await docClient.send(new ListTablesCommand({}));
  console.log("Existing tables:", data2.TableNames); 
  const tableExists = data2.TableNames.includes('Ticket');

  // 티켓테이블이 없다면 티켓 테이블 생성
  if(!tableExists){
  const params = {
    TableName: "Ticket",
    KeySchema: [
      { AttributeName: "TID", KeyType: "HASH" }  // Partition key
    ],
    AttributeDefinitions: [
      { AttributeName: "TID", AttributeType: "S" }  // 'S'는 String 타입
    ],
    ProvisionedThroughput: {
      ReadCapacityUnits: 5,
      WriteCapacityUnits: 5
    }
  };
    try {
      // Ticket 테이블 생성
      console.log("33333333333333333333333");
      const data = await docClient.send(new CreateTableCommand(params));
      console.log("Ticket 테이블 생성 성공:", data);
      return { success: true, data };
    } catch (error) {
      console.error("Ticket 테이블 생성 실패:", error);
      return { success: false, error: error.message };
    }
  }
  // 티켓 테이블이 만약 있다면
  else{
    return {success: true, message: "Ticket Table already EXISTS"};
  }
}

// 티켓 수에따라 티켓 테이블에 데이터를 업데이트함
const createTicketsForEvent = async (eventId, ticketAmount) => {
  const tickets = [];


  console.log("Ticket 테이블이 활성화되었습니다.");
  for (let i = 1; i <= ticketAmount; i++) {
    const ticketId = `${eventId}_TICKET_${i}`;  // 고유한 티켓 ID 생성
    const ticketParams = {
      TableName: 'Ticket',
      Item: {
        TID: ticketId,      // 고유한 티켓 ID
        EventID: eventId,        // 이벤트 ID
        Status: 'available',  // 티켓 상태 (구매 가능)     
      }
    };
    try {
      const ticketData = await docClient.send(new PutCommand(ticketParams));
      console.log(`티켓 생성 성공: ${ticketId}`, ticketData);
    } catch (error) {
      console.error(`티켓 생성 실패: ${ticketId}`, error);
    }
  }

  try {
    // 100개의 티켓을 DynamoDB에 생성
    await Promise.all(tickets);
    console.log(`총 ${ticketAmount}개의 티켓이 성공적으로 생성되었습니다.`);
    return { success: true, message: `${ticketAmount}개의 티켓이 생성되었습니다.` };
  } catch (error) {
    console.error('티켓 생성 실패:', error);
    return { success: false, error: '티켓 생성 실패' };
  }
};


// 데이터 저장을 위한 함수 (POST)
const saveDataToDynamoDB = async (eventBody) => {

  let requestBody;

  // JSON 파싱 시도
  try {
    requestBody = JSON.parse(eventBody);
  } catch (error) {
    // JSON 파싱 실패 시 400 에러 반환
    return { success: false, error: "Invalid JSON in request body" };
  }

  const { itemValue, dayValue, nameValue, placeValue, venueID } = requestBody;

   // Venue 테이블에서 좌석 수(SEATS) 조회
   const venueResult = await getVenueSeats(venueID);
   if (!venueResult.success) {
     return { success: false, error: venueResult.error };
   }

  const param = {
    TableName: 'Event',
    Item: {
      Item: itemValue,
      Day: dayValue,
      Name: nameValue,
      Place: placeValue   // DynamoDB의 파티션 키인 "Item"에 저장
    }
  };

  try {
    // 데이터 저장
    const data = await docClient.send(new PutCommand(param));
    console.log("저장 성공:", data);
    console.log("111111111111111");
    const ticketTableResult = await MakeTicketTable(itemValue);
    console.log("2222222222222222");
    //에러 디텍터
    if (!ticketTableResult.success) {
      return { success: false, error: ticketTableResult.error };
    }


    // SEATS 값을 ticketAmount에 저장
    const ticketAmount = venueResult.seats;
    console.log(`티켓 수: ${ticketAmount}`);
    // 잠시 티켓 테이블이 생성될동안 대기...5초
    await new Promise(resolve => setTimeout(resolve, 5000));
    // 저장후 티켓수에 대한 티켓들을 티켓 테이블에 저장 
    const ticketResult = await createTicketsForEvent(itemValue, ticketAmount);


    // 에러 디택터 for 티켓 수를 티켓테이블에 저장.
    if (!ticketResult.success) {
      return { success: false, error: ticketResult.error };
    }


    return { success: true, data, ticketAmount, ticketTableResult };
  } catch (error) {
    console.error("저장 실패:", error);
    return { success: false, error: error.message };
  }
};

// 데이터 삭제를 위한 함수
const deleteDataFromDynamoDB = async (eventBody) => {
  let requestBody;

  // JSON 파싱 시도
  try {
    requestBody = JSON.parse(eventBody);
  } catch (error) {
    // JSON 파싱 실패 시 400 에러 반환
    return { success: false, error: "Invalid JSON in request body" };
  }

  const { itemValue, dayValue, nameValue, placeValue } = requestBody;

  const param = {
    TableName: 'Event',
    Key: {
      Item: itemValue  // 삭제할 데이터의 파티션 키 (Item)
    }
  };

  try {
    // 데이터 삭제
    const data = await docClient.send(new DeleteCommand(param));
    console.log("삭제 성공:", data);
    return { success: true, data };
  } catch (error) {
    console.error("삭제 실패:", error);
    return { success: false, error: error.message };
  }
};

// 데이터 조회를 위한 함수 (GET)
const getDataFromDynamoDB = async (eventBody) => {
  let requestBody;

  // JSON 파싱 시도
  try {
    requestBody = JSON.parse(eventBody);
  } catch (error) {
    // JSON 파싱 실패 시 400 에러 반환
    return { success: false, error: "Invalid JSON in request body" };
  }

  const { itemValue } = requestBody;

  const param = {
    TableName: 'Event',
    Key: {
      Item: itemValue  // DynamoDB의 파티션 키로 조회
    }
  };

  try {
    // 데이터 조회
    const data = await docClient.send(new GetCommand(param));
    console.log("데이터 조회 성공:", data);
    return { success: true, data: data.Item };
  } catch (error) {
    console.error("데이터 조회 실패:", error);
    return { success: false, error: error.message };
  }
};

// 데이터 업데이트를 위한 함수 (PUT)
const updateDataInDynamoDB = async (eventBody) => {
  let requestBody;

  // JSON 파싱 시도
  try {
    requestBody = JSON.parse(eventBody);
  } catch (error) {
    // JSON 파싱 실패 시 400 에러 반환
    return { success: false, error: "Invalid JSON in request body" };
  }

  const { itemValue, dayValue, nameValue, placeValue } = requestBody;

  const param = {
    TableName: 'Event',
    Item: {
        Item: itemValue,
        Day: dayValue,
        Name: nameValue,
        Place: placeValue  // 업데이트할 데이터의 파티션 키 (Item)
    }
  };

  try {
    // 데이터 업데이트
    const data = await docClient.send(new PutCommand(param));
    console.log("업데이트 성공:", data);
    return { success: true, data };
  } catch (error) {
    console.error("업데이트 실패:", error);
    return { success: false, error: error.message };
  }
};



// status 가 available한 티켓들을 가져오기
const getAvailableTickets = async (eventID) => {
  const params = {
    TableName: 'Ticket',
    IndexName: 'EventIDStatusIndex', // GSI 이름 
    FilterExpression: "#status = :status AND #eventID = :eventID",  // 필터 조건 설정
    ExpressionAttributeNames: {
      "#status": "Status",
      "#eventID": "EventID"  // 예약어 처리
    },
    ExpressionAttributeValues: {
      ":status": "available",
      ":eventID": eventID  // available 상태의 티켓만 조회
    }
  };

  try {
    const availableTickets = await docClient.send(new QueryCommand(params));
    const tickets = availableTickets.Items;

    //Redis에 예약된 티켓 필터링
    const filteredTickets = [];
    for (const ticket of tickets){
      const isReserved = await client.get(`resevedTicket:${ticket.TicketID}`);
      if(!isReserved){
        filteredTickets.push(ticket);
      }

    }
    console.log("조회된 티켓:", filteredTickets);
    return { success: true, availableTickets: filteredTickets };
  } catch (error) {
    console.error("티켓 조회 실패:", error);
    return { success: false, error: error.message };
  }
};


// 티켓 예약 (10분동안 유지)
const bookTicket = async (ticketID) => {
  const ttl = 600; // 10분동안 ttl 설정

  try {
    //Redis에 티켓 저장 및 ttl 설정
    await client.setex(`reservedTicket:${ticketID}`, ttl);
    console.log(`티켓 ${ticketID}이 예약됨`);
  } catch(error){
    console.log('예약 실패: ', error);
  }
};




// Lambda 핸들러
exports.handler = async (event) => {
  console.log("Event Path:", event.path);
  // 요청 메서드가 POST인지 확인
  
  if(event.path.includes('/getget')){
    console.log("여기가 실행됩니다!");
    const requestBody = JSON.parse(event.body);
    const {eventID, TID} = requestBody;

    const result1 = await getAvailableTickets(eventID);
    if (result1.success && result1.availableTickets.length > 0) {
      // 요청된 TID와 일치하는 티켓을 찾기
      const ticketToReserve = result1.availableTickets.find(ticket => ticket.TID === TID);

      await bookTicket(ticketToReserve.TID)

      return {
        statusCode: 200,
        body: JSON.stringify({
          message: `티켓 ${ticketToReserve.TID} 예약 성공`,
          reservedTicket: ticketToReserve.TID  // TID로 예약된 티켓 정보 반환
        })
      };

    }
      if (result1.success) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "available 상태의 티켓 조회 성공",
            availableTickets: result1.availableTickets
          })
        };
      } else {
        return {
          statusCode: 400,
          body: JSON.stringify({ message: "티켓 조회 실패", error: result1.error })
        };
      }
  }

  if (event.httpMethod === 'POST') {
    // 데이터 저장 함수 호출 (event.body 전달)
    const result = await saveDataToDynamoDB(event.body);
    // 결과에 따라 응답 처리
    if (result.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({ 
          message: "데이터 저장 성공", 
          tickets: result.ticketAmount, 
          data: result.data,
          ticketTableData: result.ticketTableResult
        })
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "데이터 저장 실패", error: result.error })
      };
    }
  } 
  // 요청 메서드가 DELETE인지 확인
  else if (event.httpMethod === 'DELETE') {
    // 데이터 삭제 함수 호출 (event.body 전달)
    const result = await deleteDataFromDynamoDB(event.body);
    // 결과에 따라 응답 처리
    if (result.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "데이터 삭제 성공", data: result.data })
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "데이터 삭제 실패", error: result.error })
      };
    }
  } 
  // 요청 메서드가 GET인지 확인
  else if (event.httpMethod === 'GET') {
    // 데이터 조회 함수 호출 (event.body 전달)
    const result = await getDataFromDynamoDB(event.body);

    // 결과에 따라 응답 처리
    if (result.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "데이터 조회 성공11111", data: result.data })
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "데이터 조회 실패", error: result.error })
      };
    }
  } 
  // 요청 메서드가 PUT인지 확인 (업데이트 또는 생성)
  else if (event.httpMethod === 'PUT') {
    // 데이터 업데이트 함수 호출 (event.body 전달)
    const result = await updateDataInDynamoDB(event.body);
    // 결과에 따라 응답 처리
    if (result.success) {
      return {
        statusCode: 200,
        body: JSON.stringify({ message: "데이터 업데이트 성공", data: result.data })
      };
    } else {
      return {
        statusCode: 400,
        body: JSON.stringify({ message: "데이터 업데이트 실패", error: result.error })
      };
    }
  } 
    
   
};