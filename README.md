# 두부 게임기·대화 프로토타입

두부를 게임기 화면에서 만나고, **산책 / 혼자 있을 때 / 첫 만남** 이야기를 나눠보는 화면이야. 프론트엔드에서 디자인과 움직임을 확인할 수 있도록 HTML 미리보기와 React Native 앱을 함께 넣었어.

## 바로 보기

`index.html`을 브라우저에서 열면 돼. 게임기에서 주제를 고른 뒤 A 버튼을 누르면 대화창이 열려. 이미 나눈 주제를 다시 누르면 **대화 기록은 그대로 둔 채** 그 대화가 가운데 오도록 스크롤해.

하트를 누르면 저장 안내가 나오고, B 버튼을 누르면 두부가 간식을 먹는 애니메이션을 볼 수 있어. 지금 대화는 화면 확인용 예시라 실제 서버와 연결되어 있지는 않아.

## iPhone 시뮬레이터에서 보기

Node.js 22.13 이상 또는 24.3 이상, Xcode와 CocoaPods가 필요해.

```bash
npm ci
cd ios && pod install && cd ..
npm start
```

다른 터미널에서 `npm run ios`를 실행하면 돼. Android는 `npm run android`로 실행할 수 있어.

화면 코드는 [`ConsoleChatPreviewScreen.tsx`](src/modules/dog/ConsoleChatPreviewScreen.tsx)에 있어. 화면 구성을 바꾸거나 실제 API를 붙일 때 여기부터 보면 돼. `npm run typecheck`와 `npm run lint`로 기본 검사도 할 수 있어.

## 폰트와 리소스

도트 글꼴 Galmuri11과 본문 글꼴 Gowun Dodum은 각각 SIL Open Font License 1.1을 따라. 라이선스 전문은 [`src/modules/dog/assets/fonts`](src/modules/dog/assets/fonts)에 넣어뒀어. 게임기·두부 이미지와 움직임 프레임은 이 프로토타입 화면용 리소스야.
