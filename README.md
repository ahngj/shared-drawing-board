# 🎨 Shared Drawing Board

AWS 클라우드 네이티브 환경에서 구축한 **실시간 양방향 드로잉 웹 서비스**입니다.
서버리스 아키텍처와 실시간 통신 서버를 결합하여 **자원 효율성**과 **실시간성**을 동시에 달성하는 것을 목표로 했습니다.

---

## 📌 Overview

* 여러 사용자가 동일한 방(Session)에 접속해 실시간으로 그림을 그릴 수 있는 웹 서비스
* WebSocket 기반 실시간 통신
* 서버리스 + EC2 혼합 아키텍처
* 세션 종료 시 자동 리소스 정리(Cleanup)

---

## 🏗 System Architecture

```
[ Client (Browser) ]
        |
        |  HTTPS
        v
[ API Gateway ] ──> [ AWS Lambda ] ──> [ DynamoDB ]
        |
        |  WebSocket (ws)
        v
[ EC2 - Node.js Realtime Server ]
```

### 1. Static Hosting

* **AWS S3**
* 프론트엔드 정적 자산(HTML, JS) 호스팅

### 2. Session & Security

* **API Gateway + AWS Lambda**
* 방 생성(create-session)
* 서버 측 비밀번호 검증(verify-password)

### 3. Real-time Communication

* **AWS EC2 (Node.js)**
* WebSocket(ws)를 이용한 실시간 드로잉 데이터 브로드캐스팅

### 4. Database

* **AWS DynamoDB**
* 세션 정보 및 보안 데이터 영구 저장

---

## ⚙️ Key Implementation Logic (Backend)

### 1. 실시간 데이터 동기화 및 최적화

#### WebSocket Broadcasting

* 세션별로 접속 유저를 관리
* 동일한 방(Session)에 속한 유저에게만 드로잉 데이터를 브로드캐스팅

#### Drawing History Cache

* 서버 메모리에 드로잉 내역을 캐싱
* 새로 접속한 유저에게 기존 그림을 즉시 전송하여 동기화 문제 해결

#### Throttling

* 클라이언트 단에서 **15ms 단위 쓰로틀링** 적용
* 네트워크 트래픽 감소와 부드러운 드로잉 UX를 동시에 확보

---

### 2. 리소스 자동 최적화 (Cleanup System)

#### Auto-Deletion

* 모든 사용자가 브라우저를 종료하여 세션 인원이 `0명`이 되면 트리거 발생
* EC2 서버에서 이를 감지하여 DynamoDB 세션 데이터 즉시 삭제
* 불필요한 세션 데이터 및 리소스 낭비 방지

---

### 3. 서버 측 보안 검증

#### Lambda Verification

* 비밀번호 검증 로직을 **클라이언트가 아닌 Lambda**에서 수행

#### Secure Access Flow

1. 사용자가 비밀번호 입력
2. `verify-password API` 호출
3. 검증 성공 시에만 WebSocket 연결 허용

→ WebSocket 서버 직접 공격 및 우회 접근 방지

---

## 🧩 Troubleshooting

### 1. Runtime Version Error (AWS SDK v3)

* 문제: AWS SDK v3 사용 시 Node.js 구버전으로 인한 `SyntaxError`
* 해결:

  * EC2 환경에서 **NVM**을 사용해 Node.js **v18 LTS**로 업그레이드

### 2. 502 Bad Gateway (API Gateway)

* 문제:

  * Lambda 응답 형식이 프록시 통합 규칙과 불일치
  * DynamoDB 접근 권한 부족
* 해결:

  * Lambda 응답 구조 수정
  * IAM 정책에 DynamoDB 접근 권한 추가

---

## 🚀 How to Run (Deployment)

### 1. DynamoDB

* 테이블 생성: `Sessions`
* Partition Key: `sessionId`

### 2. Lambda & API Gateway

* Lambda 함수 배포

  * `create-session`
  * `verify-password`
* API Gateway와 연동

### 3. EC2 (Realtime Server)

* 인스턴스 보안 그룹에서 **3000번 포트 오픈**
* 서버 실행

```bash
node server.js
```

### 4. S3 (Frontend)

* `app.js` 내 API / WebSocket 엔드포인트 주소 수정
* 정적 파일을 S3 버킷에 업로드

---

## 🛠 Tech Stack

* **Frontend**: HTML, JavaScript
* **Backend**: Node.js, WebSocket(ws)
* **Cloud**: AWS (S3, EC2, Lambda, API Gateway, DynamoDB)

---

## 📈 What I Learned

* 서버리스 아키텍처와 실시간 서버의 역할 분리 설계
* WebSocket 기반 실시간 동기화 처리 경험
* AWS IAM, API Gateway, Lambda 통합 시 발생하는 문제 해결 역량
* 클라우드 환경에서의 리소스 자동 정리 전략

---

## 📎 Future Improvements

* WebSocket 서버 Auto Scaling 구조 개선
* Drawing History를 DynamoDB 또는 Redis로 분리
* 인증 토큰 기반 접근 제어(JWT)
* 모바일 UX 개선
