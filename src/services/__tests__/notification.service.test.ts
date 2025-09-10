/**
 * Unit tests for src/services/notification.service.ts
 *
 * These tests mock platform + expo-notifications and the browser Notification/serviceWorker APIs.
 * Tests are structured to mock modules before requiring the service module (jest.resetModules + jest.doMock).
 */

describe("notification.service (web)", () => {
  beforeEach(() => {
    jest.resetModules();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    // cleanup globals that tests may set
    // @ts-ignore
    delete global.Notification;
    // @ts-ignore
    delete global.navigator;
  });

  test("requestPermission returns true when Notification.requestPermission resolves 'granted' (web)", async () => {
    // Mock react-native Platform as web
    jest.doMock("react-native", () => ({ Platform: { OS: "web" } }));

    // Mock window.Notification.requestPermission
    const mockRequest = jest.fn(() => Promise.resolve("granted"));
    // @ts-ignore
    global.Notification = { requestPermission: mockRequest };

    const svc = await import("../notification.service");

    const res = await svc.requestPermission();
    expect(res).toBe(true);
    expect(mockRequest).toHaveBeenCalled();
  });

  test("scheduleNotificationAfterSeconds uses expo-notifications scheduleNotificationAsync on web when available", async () => {
    jest.doMock("react-native", () => ({ Platform: { OS: "web" } }));

    const mockSchedule = jest.fn(() => Promise.resolve("expo-id-123"));
    const mockCancel = jest.fn(() => Promise.resolve());
    jest.doMock("expo-notifications", () => ({
      scheduleNotificationAsync: mockSchedule,
      cancelScheduledNotificationAsync: mockCancel,
      getPermissionsAsync: jest.fn(),
      requestPermissionsAsync: jest.fn(),
    }));

    const svc = await import("../notification.service");

    const result = await svc.scheduleNotificationAfterSeconds(5, "Title", "Body");
    expect(result).toBeDefined();
    expect(result.id).toBe("expo-id-123");
    expect(mockSchedule).toHaveBeenCalled();
  });

  test("scheduleNotificationAfterSeconds falls back to setTimeout + SW/Notification when expo schedule fails and cancel clears timeout", async () => {
    jest.doMock("react-native", () => ({ Platform: { OS: "web" } }));

    // Force expo-notifications schedule to throw so the fallback path runs
    jest.doMock("expo-notifications", () => ({
      scheduleNotificationAsync: jest.fn(() => Promise.reject(new Error("not-supported"))),
      cancelScheduledNotificationAsync: jest.fn(),
      getPermissionsAsync: jest.fn(),
      requestPermissionsAsync: jest.fn(),
    }));

    // Provide a mock serviceWorker.showNotification and a Notification constructor mock
    // @ts-ignore
    global.navigator = { serviceWorker: { showNotification: jest.fn(() => Promise.resolve()) } };
    // @ts-ignore
    global.Notification = function MockNotification(title: string, opts: any) {
      // noop
    };

    const svc = await import("../notification.service");

    const result = await svc.scheduleNotificationAfterSeconds(60, "Fallback", "Body");
    expect(result).toBeDefined();
    expect(typeof result.id).toBe("string");
    expect((result.id as string).startsWith("web-timeout-")).toBe(true);

    // Spy on clearTimeout to ensure cancelScheduledNotification clears the scheduled timeout
    const clearSpy = jest.spyOn(global, "clearTimeout");

    await svc.cancelScheduledNotification(result.id);
    // clearTimeout should have been called with the parsed timeout id
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });

  test("cancelScheduledNotification calls expo.cancelScheduledNotificationAsync when given an expo id on web", async () => {
    jest.doMock("react-native", () => ({ Platform: { OS: "web" } }));

    const mockSchedule = jest.fn(() => Promise.resolve("expo-id-xyz"));
    const mockCancel = jest.fn(() => Promise.resolve());
    jest.doMock("expo-notifications", () => ({
      scheduleNotificationAsync: mockSchedule,
      cancelScheduledNotificationAsync: mockCancel,
      getPermissionsAsync: jest.fn(),
      requestPermissionsAsync: jest.fn(),
    }));

    const svc = await import("../notification.service");

    const res = await svc.scheduleNotificationAfterSeconds(10, "T", "B");
    expect(res.id).toBe("expo-id-xyz");

    await svc.cancelScheduledNotification(res.id);
    expect(mockCancel).toHaveBeenCalledWith("expo-id-xyz");
  });
});
