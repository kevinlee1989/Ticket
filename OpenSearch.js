const { Client } = require('@opensearch-project/opensearch');
const { DynamoDBClient } = require("@aws-sdk/client-dynamodb");
const { DynamoDBDocumentClient } = require("@aws-sdk/lib-dynamodb");
const AWS = require('aws-sdk');  // AWS SDK 추가
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

// OpenSearch 클라이언트 설정
const clientOpen = new Client({
  node: 'https://search-movie-evbevu5qdtvq47xumxm5eebpee.aos.us-west-2.on.aws',  // OpenSearch 도메인 엔드포인트
  auth: {
    username: 'kjmin99999',  // OpenSearch 관리자 사용자 이름
    password: '1034913aA@@'   // OpenSearch 관리자 비밀번호
  },
  ssl: {
    rejectUnauthorized: false  // 인증서 검증 비활성화
  }
});

// OpenSearch로 데이터 삽입 함수
async function insertDataToOpenSearch(index, data) {
  try {
    const response = await clientOpen.index({
      index: index,  // OpenSearch 인덱스 이름
      id: data.Item,
      body: data     // DynamoDB에서 가져온 데이터
    });
    console.log('OpenSearch에 데이터 삽입 성공:', response);
  } catch (error) {
    console.error('OpenSearch 데이터 삽입 실패:', error);
  }
}

// OpenSearch에서 데이터 삭제 함수
async function deleteDataFromOpenSearch(index, itemValue) {
  try {
    const response = await clientOpen.delete({
      index: index,  // OpenSearch 인덱스 이름
      id: itemValue         // 삭제할 데이터의 ID
    });
    console.log('OpenSearch에서 데이터 삭제 성공:', response);
  } catch (error) {
    console.error('OpenSearch 데이터 삭제 실패:', error);
  }
}

// Lambda 함수 핸들러 (DynamoDB 스트림 이벤트 핸들링)
exports.handler = async (event) => {
  try {
    for (const record of event.Records) {
      const eventName = record.eventName;  // INSERT, MODIFY, REMOVE 이벤트 구분
      const newImage = record.dynamodb.NewImage;  // 새로 추가되거나 수정된 데이터
      const oldImage = record.dynamodb.OldImage;  // 삭제되었거나 수정 전의 데이터

      if (eventName === 'INSERT' || eventName === 'MODIFY') {
        // 새로 추가되었거나 수정된 데이터를 OpenSearch에 복사
        const data = AWS.DynamoDB.Converter.unmarshall(newImage);  // DynamoDB 데이터를 JavaScript 객체로 변환
        await insertDataToOpenSearch('my-index', data);
      } else if (eventName === 'REMOVE') {
        // 삭제된 데이터는 OpenSearch에서 제거
        const oldData = AWS.DynamoDB.Converter.unmarshall(oldImage);
  
          await deleteDataFromOpenSearch('my-index', oldData.Item);
          console.error('삭제할 데이터의 ID를 찾을 수 없습니다.');
      }
    }

    console.log('모든 스트림 이벤트를 성공적으로 처리했습니다.');
    return {
      statusCode: 200,
      body: JSON.stringify({
        message: '스트림 이벤트 처리 성공'
      })
    };
  } catch (error) {
    console.error('스트림 이벤트 처리 중 오류 발생:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: '스트림 이벤트 처리 실패',
        error: error.message
      })
    };
  }
};