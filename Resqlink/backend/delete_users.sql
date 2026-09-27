SET FOREIGN_KEY_CHECKS=0;

CREATE TEMPORARY TABLE temp_user_ids AS 
SELECT id FROM users WHERE email IN (
  'buildmanila@resqlink.ph', 
  'quickrepair@resqlink.ph', 
  'juan.delacruz@resqlink.ph', 
  'pedro.penduko@resqlink.ph', 
  'b@gmail.com'
);

DELETE FROM profiles WHERE user_id IN (SELECT id FROM temp_user_ids);
DELETE FROM verification_requests WHERE user_id IN (SELECT id FROM temp_user_ids);
DELETE FROM messages WHERE sender_id IN (SELECT id FROM temp_user_ids) OR receiver_id IN (SELECT id FROM temp_user_ids);
DELETE FROM conversations WHERE participant1_id IN (SELECT id FROM temp_user_ids) OR participant2_id IN (SELECT id FROM temp_user_ids);
DELETE FROM users WHERE id IN (SELECT id FROM temp_user_ids);

SET FOREIGN_KEY_CHECKS=1;
