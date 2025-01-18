const { DynamoDBClient, ListTablesCommand, CreateTableCommand } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient, PutCommand, DeleteCommand, GetCommand } = require("@aws-sdk/lib-dynamodb");

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
  
    const { PIDValue, nameValue, ageValue, genreValue } = requestBody;

  
    const param = {
      TableName: 'Performer',
      Item: {
        PID: itemValue,
        name: nameValue,
        Age: ageValue,
        Genre: genreValue   // DynamoDB의 파티션 키인 "PID"에 저장
      }
    };
  
    try {
      // 데이터 저장
      const data = await docClient.send(new PutCommand(param));
      console.log("저장 성공:", data);
      return { success: true, data};
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
  
    const { PIDValue, nameValue, ageValue, genreValue } = requestBody;
  
    const param = {
      TableName: 'Performer',
      Key: {
        PID: PIDValue  // 삭제할 데이터의 파티션 키 (PID)
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
  
    const {  PIDValue } = requestBody;
  
    const param = {
      TableName: 'Performer',
      Key: {
        PID:  PIDValue  // DynamoDB의 파티션 키로 조회
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
  
    const {PIDValue, nameValue, ageValue, genreValue } = requestBody;
  
    const param = {
        TableName: 'Performer',
        Item: {
          PID: itemValue,
          name: nameValue,
          Age: ageValue,
          Genre: genreValue   // DynamoDB의 파티션 키인 "PID" 에 업데이트
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
  
  
  // Lambda 핸들러
  exports.handler = async (event) => {
    // 요청 메서드가 POST인지 확인
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
            ticketTableData: result.ticketTableData
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
          body: JSON.stringify({ message: "데이터 조회 성공", data: result.data })
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
    // 허용되지 않은 메서드 처리
    else {
      return {
        statusCode: 405,  // 405: Method Not Allowed
        body: JSON.stringify({ message: "Only POST, DELETE, GET, and PUT methods are allowed" })
      };
    }
  };