# API coverage

Pinned provider routes: 111. Executable catalogue operations: 94. Workflow-owned routes: 3. Exclusions: 13. Pending: 1.

This inventory compares the pinned Application and Client route files. Implemented means verified against controlled provider contracts, not accepted against every deployed panel version. It does not cover admin web-only features such as egg import/export, mounts and transfers.

Each executable operation has an independent SDK-to-HTTP wire contract. Workflow routes keep signed URLs and WebSocket tokens internal. Exclusions and pending routes cannot execute through the generic tools.

| Operation | Method and route | Status | Reason or focused tool |
| --- | --- | --- | --- |
| application.users.list | GET /api/application/users | implemented |  |
| application.users.get | GET /api/application/users/{user} | implemented |  |
| application.users.external | GET /api/application/users/external/{external_id} | implemented |  |
| application.users.create | POST /api/application/users | implemented |  |
| application.users.update | PATCH /api/application/users/{user} | implemented |  |
| application.users.delete | DELETE /api/application/users/{user} | implemented |  |
| application.nodes.list | GET /api/application/nodes | implemented |  |
| application.nodes.deployable | GET /api/application/nodes/deployable | implemented |  |
| application.nodes.get | GET /api/application/nodes/{node} | implemented |  |
| application.nodes.configuration | GET /api/application/nodes/{node}/configuration | excluded | Wings configuration includes daemon credentials. Install it through the private deployment secret channel. |
| application.nodes.create | POST /api/application/nodes | implemented |  |
| application.nodes.update | PATCH /api/application/nodes/{node} | implemented |  |
| application.nodes.delete | DELETE /api/application/nodes/{node} | implemented |  |
| application.nodes.allocations.list | GET /api/application/nodes/{node}/allocations | implemented |  |
| application.nodes.allocations.create | POST /api/application/nodes/{node}/allocations | implemented |  |
| application.nodes.allocations.delete | DELETE /api/application/nodes/{node}/allocations/{allocation} | implemented |  |
| application.locations.list | GET /api/application/locations | implemented |  |
| application.locations.get | GET /api/application/locations/{location} | implemented |  |
| application.locations.create | POST /api/application/locations | implemented |  |
| application.locations.update | PATCH /api/application/locations/{location} | implemented |  |
| application.locations.delete | DELETE /api/application/locations/{location} | implemented |  |
| application.servers.list | GET /api/application/servers | implemented |  |
| application.servers.get | GET /api/application/servers/{server} | implemented |  |
| application.servers.external | GET /api/application/servers/external/{external_id} | implemented |  |
| application.servers.details | PATCH /api/application/servers/{server}/details | implemented |  |
| application.servers.build | PATCH /api/application/servers/{server}/build | implemented |  |
| application.servers.startup | PATCH /api/application/servers/{server}/startup | implemented |  |
| application.servers.create | POST /api/application/servers | implemented |  |
| application.servers.suspend | POST /api/application/servers/{server}/suspend | implemented |  |
| application.servers.unsuspend | POST /api/application/servers/{server}/unsuspend | implemented |  |
| application.servers.reinstall | POST /api/application/servers/{server}/reinstall | implemented |  |
| application.servers.delete | DELETE /api/application/servers/{server} | implemented |  |
| application.servers.force_delete | DELETE /api/application/servers/{server}/{force?} | implemented |  |
| application.servers.databases.list | GET /api/application/servers/{server}/databases | implemented |  |
| application.servers.databases.get | GET /api/application/servers/{server}/databases/{database} | implemented |  |
| application.servers.databases.create | POST /api/application/servers/{server}/databases | implemented |  |
| application.servers.databases.reset_password | POST /api/application/servers/{server}/databases/{database}/reset-password | implemented |  |
| application.servers.databases.delete | DELETE /api/application/servers/{server}/databases/{database} | implemented |  |
| application.nests.list | GET /api/application/nests | implemented |  |
| application.nests.get | GET /api/application/nests/{nest} | implemented |  |
| application.nests.eggs.list | GET /api/application/nests/{nest}/eggs | implemented |  |
| application.nests.eggs.get | GET /api/application/nests/{nest}/eggs/{egg} | implemented |  |
| client.servers.list | GET /api/client | implemented |  |
| client.permissions | GET /api/client/permissions | implemented |  |
| client.account.get | GET /api/client/account | implemented |  |
| client.account.get.two-factor | GET /api/client/account/two-factor | excluded | Account authentication and credential management are outside the server operating capability. |
| client.account.post.two-factor | POST /api/client/account/two-factor | excluded | Account authentication and credential management are outside the server operating capability. |
| client.account.post.two-factor.disable | POST /api/client/account/two-factor/disable | excluded | Account authentication and credential management are outside the server operating capability. |
| client.account.put.email | PUT /api/client/account/email | excluded | Account authentication and credential management are outside the server operating capability. |
| client.account.put.password | PUT /api/client/account/password | excluded | Account authentication and credential management are outside the server operating capability. |
| client.account.activity | GET /api/client/account/activity | implemented |  |
| client.account.api_keys.list | GET /api/client/account/api-keys | excluded | Account credential management is outside the game-server operating capability. |
| client.account.post.api-keys | POST /api/client/account/api-keys | excluded | Account authentication and credential management are outside the server operating capability. |
| client.account.delete.api-keys.{identifier} | DELETE /api/client/account/api-keys/{identifier} | excluded | Account authentication and credential management are outside the server operating capability. |
| client.account.get.ssh-keys | GET /api/client/account/ssh-keys | excluded | Account authentication and credential management are outside the server operating capability. |
| client.account.post.ssh-keys | POST /api/client/account/ssh-keys | excluded | Account authentication and credential management are outside the server operating capability. |
| client.account.post.ssh-keys.remove | POST /api/client/account/ssh-keys/remove | excluded | Account authentication and credential management are outside the server operating capability. |
| client.servers.get | GET /api/client/servers/{server} | implemented |  |
| client.websocket | GET /api/client/servers/{server}/websocket | workflow | Signed credentials stay inside the focused tool instead of being returned to the model. Use ptero_console_tail. |
| client.servers.resources | GET /api/client/servers/{server}/resources | implemented |  |
| client.servers.activity | GET /api/client/servers/{server}/activity | implemented |  |
| client.servers.command | POST /api/client/servers/{server}/command | implemented |  |
| client.servers.power | POST /api/client/servers/{server}/power | implemented |  |
| client.databases.list | GET /api/client/servers/{server}/databases | implemented |  |
| client.databases.create | POST /api/client/servers/{server}/databases | implemented |  |
| client.databases.rotate_password | POST /api/client/servers/{server}/databases/{database}/rotate-password | implemented |  |
| client.databases.delete | DELETE /api/client/servers/{server}/databases/{database} | implemented |  |
| client.files.list | GET /api/client/servers/{server}/files/list | implemented |  |
| client.files.contents | GET /api/client/servers/{server}/files/contents | implemented |  |
| client.files.download | GET /api/client/servers/{server}/files/download | workflow | Signed credentials stay inside the focused tool instead of being returned to the model. Use ptero_file_hash. |
| client.files.rename | PUT /api/client/servers/{server}/files/rename | implemented |  |
| client.files.copy | POST /api/client/servers/{server}/files/copy | implemented |  |
| client.files.write | POST /api/client/servers/{server}/files/write | implemented |  |
| client.files.compress | POST /api/client/servers/{server}/files/compress | implemented |  |
| client.files.decompress | POST /api/client/servers/{server}/files/decompress | implemented |  |
| client.files.delete | POST /api/client/servers/{server}/files/delete | implemented |  |
| client.files.create_folder | POST /api/client/servers/{server}/files/create-folder | implemented |  |
| client.files.chmod | POST /api/client/servers/{server}/files/chmod | implemented |  |
| client.files.pull | POST /api/client/servers/{server}/files/pull | excluded | Arbitrary URL fetching by Wings bypasses artifact and destination policy. Use the verified upload tool. |
| client.files.upload | GET /api/client/servers/{server}/files/upload | workflow | Signed credentials stay inside the focused tool instead of being returned to the model. Use ptero_file_upload. |
| client.schedules.list | GET /api/client/servers/{server}/schedules | implemented |  |
| client.schedules.create | POST /api/client/servers/{server}/schedules | implemented |  |
| client.schedules.get | GET /api/client/servers/{server}/schedules/{schedule} | implemented |  |
| client.schedules.update | POST /api/client/servers/{server}/schedules/{schedule} | implemented |  |
| client.schedules.execute | POST /api/client/servers/{server}/schedules/{schedule}/execute | implemented |  |
| client.schedules.delete | DELETE /api/client/servers/{server}/schedules/{schedule} | implemented |  |
| client.schedules.tasks.create | POST /api/client/servers/{server}/schedules/{schedule}/tasks | implemented |  |
| client.schedules.tasks.update | POST /api/client/servers/{server}/schedules/{schedule}/tasks/{task} | implemented |  |
| client.schedules.tasks.delete | DELETE /api/client/servers/{server}/schedules/{schedule}/tasks/{task} | implemented |  |
| client.allocations.list | GET /api/client/servers/{server}/network/allocations | implemented |  |
| client.allocations.create | POST /api/client/servers/{server}/network/allocations | implemented |  |
| client.allocations.update | POST /api/client/servers/{server}/network/allocations/{allocation} | implemented |  |
| client.allocations.primary | POST /api/client/servers/{server}/network/allocations/{allocation}/primary | implemented |  |
| client.allocations.delete | DELETE /api/client/servers/{server}/network/allocations/{allocation} | implemented |  |
| client.users.list | GET /api/client/servers/{server}/users | implemented |  |
| client.users.create | POST /api/client/servers/{server}/users | implemented |  |
| client.users.get | GET /api/client/servers/{server}/users/{user} | implemented |  |
| client.users.update | POST /api/client/servers/{server}/users/{user} | implemented |  |
| client.users.delete | DELETE /api/client/servers/{server}/users/{user} | implemented |  |
| client.backups.list | GET /api/client/servers/{server}/backups | implemented |  |
| client.backups.create | POST /api/client/servers/{server}/backups | implemented |  |
| client.backups.get | GET /api/client/servers/{server}/backups/{backup} | implemented |  |
| client.get.servers.server.backups.backup.download | GET /api/client/servers/{server}/backups/{backup}/download | pending | Provider route identified. Implementation and parameter/response contract validation are pending. |
| client.backups.lock | POST /api/client/servers/{server}/backups/{backup}/lock | implemented |  |
| client.backups.restore | POST /api/client/servers/{server}/backups/{backup}/restore | implemented |  |
| client.backups.delete | DELETE /api/client/servers/{server}/backups/{backup} | implemented |  |
| client.startup.list | GET /api/client/servers/{server}/startup | implemented |  |
| client.startup.update_variable | PUT /api/client/servers/{server}/startup/variable | implemented |  |
| client.settings.rename | POST /api/client/servers/{server}/settings/rename | implemented |  |
| client.settings.reinstall | POST /api/client/servers/{server}/settings/reinstall | implemented |  |
| client.settings.docker_image | PUT /api/client/servers/{server}/settings/docker-image | implemented |  |
