1. Login failed with 500. Currently, whenever there is some issue the application doesn't show user friendly messages. Add a toast service, which shows user friendly messages and make sure the toast messages are consistent with our UI styling

2. Keeping point 1 in mind, we need to store those messages. I have shared the structure below. Keep table name logs
Column	Description
Id	Unique number for each log row.
Timestamp_utc	When the event happened, in UTC.
Type	SUCCESS or FAILURE.
Status_code	The HTTP result, e.g. 200, 401, 500.
Method	The HTTP verb, e.g. GET, POST.
Path	The endpoint called, e.g. /api/auth/login.
Logged_in_user	The signed-in username, or the attempted username for a failed login. It's empty for other anonymous calls.
Error_message	A short reason for failures only, with no stack traces, passwords, tokens or keys.

3.

## Report changes

1. Remove the header line: "INTERNATIONAL JOURNAL OF SCIENCE, TECHNOLOGY, EDUCATION AND MANAGEMENT RESEARCH (IJSTER), Volume, Issue, Month and Year"

2. Remove the author block: "Ali QUMAIL1", "1Organisation, Address, City, Postcode, Country", "Tel: [Tel]; Email: [Email]"

3. Drop "Keywords:" (only journals ask for it, and this report is not being submitted to one).

4. Remove the "References" section at the end of the last page.

