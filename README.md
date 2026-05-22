# Group 5
- 23520748 - Nguyễn Đức Khoa
- 23521071 - Đặng Thành Nhân
- 23520839 - Võ Ngọc Hoàng Lâm

# Custom Script For friTap to bypass Anti-Analysis

## Tổng Quan

Thư mục này chứa một bản demo về các cơ chế phát hiện chống phân tích của malware và Custom Script này giúp friTap có thể bỏ qua các bảo vệ này để trích xuất TLS keys. Dự án bao gồm ba thành phần chính:

1. **Malware_Simulation** (`malware_sim_linux.cpp`) - Mô phỏng malware với các tính năng chống gỡ lỗi/chống phân tích
2. **Script_Bypass** (`bypass_stealth_linux.js`) - Script Frida bỏ qua các bảo vệ anti-analysis của malware
---

## Malware_Simulation: Anti-Analysis Mechanisms

### Purpose (Mục Đích)
Mô phỏng malware:
- Gửi các yêu cầu HTTPS định kỳ đến máy chủ bên ngoài
- Phát hiện và thoát nếu debuggers hoặc công cụ phân tích được gắn
- Thể hiện các kỹ thuật chống phân tích thực tế

### Anti-Analysis Mechanisms (Cơ Chế Chống Phân Tích)

#### 1. **TracerPid Detection** (Phát Hiện TracerPid)
```cpp
std::ifstream status_file("/proc/self/status");
// Đọc /proc/self/status và kiểm tra trường TracerPid
// Nếu TracerPid != 0 (và không phải process cha), debugger được phát hiện
```
- **Cách hoạt động**: Khi một debugger gắn vào, Linux kernel đặt trường `TracerPid`
- **Mục tiêu phát hiện**: GDB, LLDB, strace, và các công cụ ptrace khác
- **Hành vi thoát**: Thoát ngay lập tức nếu debugger được phát hiện

#### 2. **Frida Detection** (Phát Hiện Frida)
```cpp
std::ifstream maps_file("/proc/self/maps");
// Kiểm tra chuỗi "frida-agent" trong bản đồ bộ nhớ
```
- **Cách hoạt động**: Quét `/proc/self/maps` để tìm thư viện Frida agent
- **Mục tiêu phát hiện**: Framework Frida instrumentation
- **Hành vi thoát**: Thoát nếu phát hiện Frida

#### 3. **ptrace Self-Check** (Tự Kiểm Tra ptrace)
```cpp
long result = ptrace(PTRACE_TRACEME, 0, NULL, NULL);
if (result == -1) { /* Debugger được phát hiện */ }
```
- **Cách hoạt động**: Cố gắng ngăn chặn bất kỳ debugger nào gắn vào
- **Mục tiêu phát hiện**: Bất kỳ sự gắn kết debugger mới sau lệnh gọi này
- **Hành vi thoát**: Thoát nếu ptrace(PTRACE_TRACEME) thất bại
---

## Script_Bypass: Anti-Analysis Bypass Techniques

### Purpose (Mục Đích)
Script Frida mà:
- Hook các hàm hệ thống để bỏ qua các kiểm tra chống phân tích
- Ngăn malware phát hiện debuggers/Frida
- Cho phép đo lường minh bạch của malware

### Bypass Mechanisms (Cơ Chế Bỏ Qua)

#### 1. **ptrace Hook Bypass** (Bỏ Qua Hook ptrace)
```javascript
Interceptor.attach(libc.findExportByName("ptrace"), {
    onEnter: function (args) {
        this.request = parseInt(args[0].toString(), 10);
    },
    onLeave: function (retval) {
        if (this.request === 0) {  // PTRACE_TRACEME
            retval.replace(0);      // Trả về thành công (0)
        }
    }
});
```
- **Mục Tiêu**: Hàm `ptrace()` libc
- **Cơ Chế**: Chặn các lệnh gọi ptrace và buộc giá trị trả về thành công
- **Hiệu Quả**: Malware không thể phát hiện debugger qua ptrace

#### 2. **File Path Redirection** (Chuyển Hướng Đường Dẫn Tệp)
```javascript
function hook_open(funcName, pathArgIndex) {
    Interceptor.attach(funcPtr, {
        onEnter: function (args) {
            var path = args[pathArgIndex].readUtf8String();
            if (path.indexOf("/proc/self/status") !== -1 || 
                path.indexOf("/proc/self/maps") !== -1) {
                args[pathArgIndex] = Memory.allocUtf8String("/dev/null");
            }
        }
    });
}
```
- **Mục Tiêu**: `open()`, `fopen()`, `openat()` và các biến thể 64-bit
- **Cơ Chế**: Thay thế các tham số đường dẫn tệp bằng `/dev/null` khi malware cố gắng đọc các tệp phân tích
- **Hiệu Quả**: Malware đọc `/dev/null` trống thay vì tiết lộ tiêm TracerPid/Frida

#### 3. **Hooked Library Functions** (Các Hàm Thư Viện Được Hook)
| Function | Purpose (Mục Đích) | Path Arg Index |
|----------|---------|-----------------|
| `open` | File read (Đọc tệp) | 0 |
| `open64` | File read 64-bit (Đọc tệp 64-bit) | 0 |
| `fopen` | Stream read (Đọc luồng) | 0 |
| `fopen64` | Stream read 64-bit (Đọc luồng 64-bit) | 0 |
| `openat` | Relative path read (Đọc đường dẫn tương đối) | 1 |
| `openat64` | Relative path read 64-bit (Đọc đường dẫn tương đối 64-bit) | 1 |

### Bypass Results (Kết Quả Bỏ Qua)
Sau khi gắn, malware sẽ:
- ✅ Thất bại trong việc phát hiện ptrace/debugger
- ✅ Đọc `/dev/null` thay vì `/proc/self/status` (không phát hiện TracerPid)
- ✅ Đọc `/dev/null` thay vì `/proc/self/maps` (không phát hiện Frida)
- ✅ Tiếp tục chạy trong vòng lặp mà không thoát
- ✅ Cho phép các công cụ bên ngoài (như friTap) hook các hàm TLS
