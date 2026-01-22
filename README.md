
Shared Drawing Board
AWS 클라우드 네이티브 환경에서 구축한 실시간 양방향 드로잉 애플리케이션입니다.

System Architecture
이 프로젝트는 서버리스 아키텍처와 실시간 통신 서버를 결합하여 자원 효율성과 실시간성을 동시에 확보했습니다.

Static Hosting: AWS S3를 통해 프론트엔드 자산(HTML, JS)을 배포합니다.

Session & Security: API Gateway + AWS Lambda를 사용하여 방 생성 및 서버 측 비밀번호 검증을 수행합니다.

Real-time Communication: AWS EC2에서 구동되는 Node.js 서버가 WebSocket(ws)을 통해 유저 간 드로잉 데이터를 실시간 브로드캐스팅합니다.

Database: AWS DynamoDB에 모든 세션 정보와 보안 데이터를 영구 저장하고 관리합니다.

Key Implementation Logic (Backend)
1. 실시간 데이터 동기화 및 최적화
WebSocket Broadcasting: 세션별로 접속자를 관리하여, 동일한 방에 접속한 유저에게만 드로잉 데이터를 실시간으로 전송합니다.

Drawing History: 새로 접속한 유저가 기존 그림을 즉시 볼 수 있도록 서버 메모리에 드로잉 내역을 캐싱하여 전송하는 로직을 구현했습니다.

Throttling: 클라이언트 측에서 15ms 단위의 쓰로틀링을 적용하여 네트워크 부하를 줄이면서 부드러운 드로잉 경험을 제공합니다.

2. 리소스 자동 최적화 (Cleanup System)
Auto-Deletion: 사용자가 브라우저를 닫아 세션 인원이 0명이 되면, EC2 서버가 이를 감지하여 DynamoDB의 세션 데이터를 즉시 삭제하도록 트리거를 발생시켜 자원 낭비를 방지합니다.

3. 서버 측 보안 검증
Lambda Verification: 클라이언트가 아닌 서버(Lambda)에서 비밀번호 대조를 수행합니다.

Secure Access: verify-password API를 통해 성공 응답을 받은 유저에게만 WebSocket 연결 권한을 부여하여 보안성을 높였습니다.

Troubleshooting
Runtime Version Error: AWS SDK v3 도입 시 Node.js 버전 호환성으로 인한 SyntaxError를 확인하고, NVM을 통해 EC2 환경을 Node.js v18 LTS로 업그레이드하여 해결했습니다.

502 Bad Gateway (API Gateway): Lambda 함수의 응답 형식이 프록시 통합 규칙에 맞지 않는 문제를 파악하고, IAM 정책 수정을 통해 DynamoDB 접근 권한을 부여하여 해결했습니다.

How to Run (Deployment)
DynamoDB: Sessions 테이블 생성 (Partition Key: sessionId).

Lambda: create-session, verify-password 함수를 배포하고 API Gateway에 연결합니다.

EC2: 인스턴스 보안 그룹에서 3000번 포트를 개방하고 node server.js를 실행합니다.

S3: app.js의 엔드포인트 주소를 수정한 후 S3 버킷에 업로드합니다.
