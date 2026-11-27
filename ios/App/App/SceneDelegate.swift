import UIKit
import Capacitor
import Photos

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = StudioViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

class StudioViewController: CAPBridgeViewController {
    override func capacitorDidLoad() { bridge?.registerPluginInstance(BuongToiMediaPlugin()) }
}

@objc(BuongToiMediaPlugin)
public class BuongToiMediaPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "BuongToiMediaPlugin"
    public let jsName = "BuongToiMedia"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "save", returnType: CAPPluginReturnPromise)]
    @objc func save(_ call: CAPPluginCall) {
        guard let path = call.getString("path"), let url = URL(string: path), url.isFileURL,
              url.standardizedFileURL.path.hasPrefix(NSHomeDirectory() + "/Library/Caches/") else {
            call.reject("Tệp xuất không hợp lệ"); return
        }
        let video = (call.getString("mimeType") ?? "image/jpeg").hasPrefix("video/")
        PHPhotoLibrary.requestAuthorization(for: .addOnly) { status in
            guard status == .authorized || status == .limited else {
                call.reject("Hãy cho phép Buồng tối thêm ảnh trong Cài đặt → Ảnh"); return
            }
            PHPhotoLibrary.shared().performChanges({
                let request = PHAssetCreationRequest.forAsset()
                let options = PHAssetResourceCreationOptions()
                options.originalFilename = call.getString("name") ?? url.lastPathComponent
                request.addResource(with: video ? .video : .photo, fileURL: url, options: options)
            }) { success, error in
                if success { call.resolve(["saved": true]) }
                else { call.reject(error?.localizedDescription ?? "Không lưu được vào Ảnh") }
            }
        }
    }
}
