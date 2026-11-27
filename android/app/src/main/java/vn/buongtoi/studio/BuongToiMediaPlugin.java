package vn.buongtoi.studio;

import android.content.ContentValues;
import android.net.Uri;
import android.provider.MediaStore;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "BuongToiMedia")
public class BuongToiMediaPlugin extends Plugin {
  @PluginMethod public void save(PluginCall call) {
    Uri created = null;
    try {
      String path = call.getString("path", "");
      String mime = call.getString("mimeType", "image/jpeg");
      String name = call.getString("name", "ray-photo.jpg").replaceAll("[^\\p{L}\\p{N}._-]", "-");
      File file = new File(Uri.parse(path).getPath()).getCanonicalFile();
      String cache = getContext().getCacheDir().getCanonicalPath() + File.separator;
      if (!file.getPath().startsWith(cache) || !file.isFile()) throw new Exception("Tệp xuất không hợp lệ");
      boolean video = mime.startsWith("video/");
      ContentValues values = new ContentValues();
      values.put(MediaStore.MediaColumns.DISPLAY_NAME, name);
      values.put(MediaStore.MediaColumns.MIME_TYPE, mime);
      values.put(MediaStore.MediaColumns.RELATIVE_PATH, video ? "Movies/RAY PHOTO" : "Pictures/RAY PHOTO");
      values.put(MediaStore.MediaColumns.IS_PENDING, 1);
      android.content.ContentResolver resolver = getContext().getContentResolver();
      created = resolver.insert(video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI, values);
      if (created == null) throw new Exception("Không tạo được tệp trong thư viện");
      try (FileInputStream input = new FileInputStream(file); OutputStream output = resolver.openOutputStream(created)) {
        if (output == null) throw new Exception("Không mở được thư viện");
        byte[] buffer = new byte[65536]; int count;
        while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
      }
      values.clear(); values.put(MediaStore.MediaColumns.IS_PENDING, 0);
      resolver.update(created, values, null, null);
      JSObject result = new JSObject(); result.put("uri", created.toString()); call.resolve(result);
    } catch (Exception error) {
      if (created != null) getContext().getContentResolver().delete(created, null, null);
      call.reject("Chưa lưu được vào Ảnh: " + error.getMessage(), error);
    }
  }
}
